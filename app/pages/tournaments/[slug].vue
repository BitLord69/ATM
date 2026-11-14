<script setup lang="ts">
/**
 * Public tournament detail page
 * Accessible to everyone including guests
 */

import type { TournamentViewTabId } from "~/schemas/ui/tournament-view-tabs";

import { tournamentViewTabs } from "~/schemas/ui/tournament-view-tabs";

type TournamentDetail = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  websiteUrl: string | null;
  paymentInformation: string | null;
  facilities: string | null;
  country: string | null;
  city: string | null;
  lat: number;
  long: number;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  directorName: string | null;
  directorEmail: string | null;
  directorPhone: string | null;
  startDate: number | null;
  endDate: number | null;
  registrationOpenDate: number | null;
  registrationCloseDate: number | null;
  closedAt: number | null;
  isSanctioned: boolean;
  divisionOpen: boolean;
  divisionWomen: boolean;
  divisionMaster: boolean;
  divisionGrandMaster: boolean;
  divisionSeniorGrandMaster: boolean;
  divisionLegend: boolean;
  divisionJunior: boolean;
  keepJuniorsSeparate: boolean;
  showDivisionInResults: boolean;
  hasGolf: boolean;
  hasAccuracy: boolean;
  hasDistance: boolean;
  hasSCF: boolean;
  hasDiscathon: boolean;
  hasDDC: boolean;
  hasFreestyle: boolean;
  organizationId: string;
  status: "active" | "future" | "past";
  isActive: boolean;
  majorDivisions: Array<{ code: string; label: string }>;
  offeredDivisionCodes: string[];
  ageReferenceMode: "calendar_year" | "exact_date";
  enabledDisciplines: Array<{ key: string; label: string }>;
  isRegistrationLocked: boolean;
  isRegistrationOpen: boolean;
  registrationStatusReason:
    | "open"
    | "not_yet_open"
    | "registration_closed_date"
    | "locked_by_staff"
    | "tournament_started"
    | "tournament_closed";
  venues: Array<{
    id: number;
    name: string;
    description: string | null;
    facilities: string | null;
    lat: number;
    long: number;
  }>;
};

type MyRegistrationResponse = {
  authenticated: boolean;
  profile: {
    playerId: string | null;
    displayName: string;
    country: string;
    email: string;
    pdgaNumber: string;
    homeClub: string;
    dateOfBirth: string;
    genderCategory: "open" | "women";
  } | null;
  playerNumber: number | null;
  entries: Array<{
    id: string;
    discipline: string;
    majorDivision: string;
    minorDivisionTags: string[];
    primaryMinorDivision: string | null;
    activeCompetitiveDivision: string;
    status: "registered" | "withdrawn" | string;
    createdAt: number;
    updatedAt: number;
  }>;
  derivedMinorDivisions: string[];
  primaryMinorDivision: string | null;
};

const route = useRoute();
const slug = route.params.slug as string;

const [
  { data: tournament, pending, error, refresh: refreshTournament },
  { data: myRegistration, refresh: refreshMyRegistration },
] = await Promise.all([
  useFetch<TournamentDetail>(`/api/tournaments/${slug}`),
  useFetch<MyRegistrationResponse>(`/api/tournaments/${slug}/my-registration`),
]);

const {
  canEditTournament,
  isSysadmin,
  canInviteMembers,
} = useTournamentPermissions(slug);
const { activeTab: activeViewTab } = useSchemaTabs<TournamentViewTabId>({
  tabs: tournamentViewTabs,
  defaultTab: "overview",
});
const openingInvitePage = ref(false);

async function openInvitePage(organizationId: string) {
  if (openingInvitePage.value) {
    return;
  }

  openingInvitePage.value = true;
  try {
    await navigateTo(`/admin/invites?organizationId=${encodeURIComponent(organizationId)}`);
  }
  finally {
    openingInvitePage.value = false;
  }
}

const isTournamentFinished = computed(() => tournament.value?.status === "past");
const isTournamentClosed = computed(() => tournament.value?.closedAt != null);
const showInviteButton = computed(() => canInviteMembers.value && !isTournamentFinished.value && !isTournamentClosed.value);
const showEditButton = computed(() => {
  if (isSysadmin.value) {
    return true;
  }
  return canEditTournament.value && !isTournamentFinished.value && !isTournamentClosed.value;
});

if (error.value) {
  throw createError({
    statusCode: error.value.statusCode || 404,
    message: error.value.message || "Tournament not found",
  });
}

function formatDate(timestamp: number | null | undefined) {
  if (!timestamp)
    return "TBD";
  return new Date(timestamp).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateRange(start: number | null | undefined, end: number | null | undefined) {
  if (!start || !end)
    return "Dates TBD";
  const startDate = new Date(start);
  const endDate = new Date(end);

  if (startDate.toDateString() === endDate.toDateString()) {
    return formatDate(start);
  }

  return `${formatDate(start)} - ${formatDate(end)}`;
}

function formatRegistrationDateRange(start: number | null | undefined, end: number | null | undefined) {
  if (!start && !end) {
    return "Open until tournament start";
  }

  if (start && end) {
    return `${formatDate(start)} - ${formatDate(end)}`;
  }

  if (start) {
    return `Opens ${formatDate(start)}`;
  }

  return `Closes ${formatDate(end)}`;
}

const tournamentDirectorEmail = computed(() => tournament.value?.directorEmail || tournament.value?.contactEmail || null);
const hasMapCoordinates = computed(() => {
  if (!tournament.value) {
    return false;
  }

  return tournament.value.lat != null
    && tournament.value.long != null
    && tournament.value.lat !== 0
    && tournament.value.long !== 0;
});

const hasContactData = computed(() => {
  if (!tournament.value) {
    return false;
  }

  return !!(tournament.value.contactName || tournament.value.contactEmail || tournament.value.contactPhone);
});

const hasDirectorData = computed(() => {
  if (!tournament.value) {
    return false;
  }

  return !!(tournament.value.directorName || tournament.value.directorEmail || tournament.value.directorPhone);
});

// Self-registration state
const regMajorDivision = ref("OPEN");
const regSelectedDisciplines = ref<string[]>([]);
const regDisplayName = ref("");
const regCountry = ref("");
const regDateOfBirth = ref("");
const regGenderCategory = ref<"open" | "women">("open");
const regPdgaNumber = ref("");
const regHomeClub = ref("");

const submittingRegistration = ref(false);
const withdrawingRegistration = ref(false);
const registrationError = ref<string | null>(null);
const registrationSuccess = ref<string | null>(null);

const activeEntries = computed(() =>
  (myRegistration.value?.entries || []).filter(entry => entry.status === "registered"),
);
const isCurrentlyRegistered = computed(() => activeEntries.value.length > 0);

function syncRegistrationFormFromData() {
  const profile = myRegistration.value?.profile;
  if (profile) {
    regDisplayName.value = profile.displayName || "";
    regCountry.value = profile.country || "";
    regDateOfBirth.value = profile.dateOfBirth || "";
    regGenderCategory.value = profile.genderCategory || "open";
    regPdgaNumber.value = profile.pdgaNumber || "";
    regHomeClub.value = profile.homeClub || "";
  }

  const currentActive = activeEntries.value;
  if (currentActive.length > 0) {
    regMajorDivision.value = currentActive[0]?.majorDivision || tournament.value?.majorDivisions?.[0]?.code || "OPEN";
    regSelectedDisciplines.value = currentActive.map(e => e.discipline);
  }
  else {
    regMajorDivision.value = tournament.value?.majorDivisions?.[0]?.code || "OPEN";
    regSelectedDisciplines.value = (tournament.value?.enabledDisciplines || []).map(d => d.key);
  }
}

watch(
  [() => myRegistration.value, () => tournament.value],
  () => {
    syncRegistrationFormFromData();
  },
  { immediate: true },
);

// Live client-side preview of derived minor divisions based on birth date & gender
const previewMinorDivisions = computed(() => {
  if (!regDateOfBirth.value) {
    return [] as string[];
  }
  const birthDate = new Date(regDateOfBirth.value);
  if (Number.isNaN(birthDate.getTime())) {
    return [] as string[];
  }
  const eventDate = tournament.value?.startDate ? new Date(tournament.value.startDate) : new Date();
  let age = eventDate.getUTCFullYear() - birthDate.getUTCFullYear();
  if (tournament.value?.ageReferenceMode === "exact_date") {
    const eventMonth = eventDate.getUTCMonth();
    const birthMonth = birthDate.getUTCMonth();
    if (eventMonth < birthMonth || (eventMonth === birthMonth && eventDate.getUTCDate() < birthDate.getUTCDate())) {
      age -= 1;
    }
  }

  const adultPrefix = regGenderCategory.value === "women" ? "FP" : "MP";
  const juniorPrefix = regGenderCategory.value === "women" ? "FJ" : "MJ";
  const tags: string[] = [];

  if (age <= 18) {
    tags.push(`${juniorPrefix}18`);
  }
  for (const threshold of [40, 50, 55, 60, 65, 70, 75, 80]) {
    if (age >= threshold) {
      tags.push(`${adultPrefix}${threshold}`);
    }
  }
  return tags;
});

function selectAllDisciplines() {
  regSelectedDisciplines.value = (tournament.value?.enabledDisciplines || []).map(d => d.key);
  registrationError.value = null;
}

const isFullOverallSelected = computed(() => {
  const enabled = tournament.value?.enabledDisciplines || [];
  return enabled.length > 0 && enabled.every(d => regSelectedDisciplines.value.includes(d.key));
});

const registrationStatusBadge = computed(() => {
  const reason = tournament.value?.registrationStatusReason;
  switch (reason) {
    case "open":
      return { label: "Registration Open", badgeClass: "badge-success" };
    case "not_yet_open":
      return { label: "Not Yet Open", badgeClass: "badge-warning" };
    case "registration_closed_date":
      return { label: "Registration Closed", badgeClass: "badge-neutral" };
    case "locked_by_staff":
      return { label: "Registration Locked", badgeClass: "badge-warning" };
    case "tournament_started":
      return { label: "Tournament In Progress", badgeClass: "badge-info" };
    case "tournament_closed":
      return { label: "Tournament Finalized", badgeClass: "badge-ghost" };
    default:
      return { label: "Closed", badgeClass: "badge-neutral" };
  }
});

async function submitSelfRegistration() {
  if (!tournament.value || submittingRegistration.value) {
    return;
  }

  registrationError.value = null;
  registrationSuccess.value = null;

  if (regSelectedDisciplines.value.length === 0) {
    registrationError.value = "Please select at least one discipline to enter.";
    return;
  }

  submittingRegistration.value = true;
  try {
    await $fetch(`/api/tournaments/${slug}/entries`, {
      method: "POST",
      body: {
        majorDivision: regMajorDivision.value,
        disciplines: regSelectedDisciplines.value,
        profile: {
          displayName: regDisplayName.value.trim() || undefined,
          country: regCountry.value.trim() || null,
          dateOfBirth: regDateOfBirth.value.trim() || null,
          genderCategory: regGenderCategory.value,
          pdgaNumber: regPdgaNumber.value.trim() || null,
          homeClub: regHomeClub.value.trim() || null,
        },
      },
    });

    await Promise.all([refreshMyRegistration(), refreshTournament()]);
    registrationSuccess.value = isCurrentlyRegistered.value
      ? "Your tournament registration has been saved."
      : "Registration updated.";
  }
  catch (err: any) {
    registrationError.value = err?.data?.message || err?.message || "Failed to save registration.";
  }
  finally {
    submittingRegistration.value = false;
  }
}

async function withdrawSelfRegistration() {
  const playerId = myRegistration.value?.profile?.playerId;
  if (!playerId || withdrawingRegistration.value) {
    return;
  }

  registrationError.value = null;
  registrationSuccess.value = null;
  withdrawingRegistration.value = true;

  try {
    await $fetch(`/api/tournaments/${slug}/entries/${playerId}`, {
      method: "PATCH",
      body: {
        status: "withdrawn",
      },
    });
    await refreshMyRegistration();
    registrationSuccess.value = "You have withdrawn from this tournament.";
  }
  catch (err: any) {
    registrationError.value = err?.data?.message || err?.message || "Failed to withdraw registration.";
  }
  finally {
    withdrawingRegistration.value = false;
  }
}
</script>

<template>
  <div class="container mx-auto p-4 max-w-4xl">
    <!-- Loading State -->
    <PageLoadingState v-if="pending" />

    <!-- Tournament Details -->
    <div v-else-if="tournament">
      <!-- Back Button and Management Buttons -->
      <div class="mb-4 flex flex-wrap items-center gap-2 justify-between">
        <NuxtLink
          to="/tournaments"
          class="btn btn-ghost btn-sm gap-2"
        >
          <Icon
            name="tabler:arrow-left"
            size="18"
          />
          Back to Tournaments
        </NuxtLink>
        <div class="flex items-center gap-2">
          <button
            v-if="showInviteButton && tournament"
            type="button"
            class="btn btn-secondary btn-sm gap-2"
            :disabled="openingInvitePage"
            @click="openInvitePage(tournament.organizationId)"
          >
            <Icon
              v-if="!openingInvitePage"
              name="tabler:user-plus"
              size="18"
            />
            <span
              v-else
              class="loading loading-spinner loading-sm"
            />
            {{ openingInvitePage ? "Opening..." : "Invite Member" }}
          </button>
          <NuxtLink
            v-if="showEditButton"
            :to="`/dashboard/tournaments/${slug}/edit`"
            class="btn btn-primary btn-sm gap-2"
          >
            <Icon
              name="tabler:edit"
              size="18"
            />
            Edit Tournament
          </NuxtLink>
        </div>
      </div>

      <!-- Header -->
      <div class="mb-6">
        <div class="flex items-start justify-between gap-4 mb-2">
          <h1 class="text-4xl font-bold">
            {{ tournament.name }}
          </h1>
          <span
            v-if="tournament.isActive"
            class="badge badge-success gap-2 py-3"
          >
            <span class="w-2 h-2 bg-white rounded-full animate-pulse" />
            Live Now
          </span>
          <span
            v-else-if="tournament.status === 'future'"
            class="badge badge-info py-3"
          >
            Upcoming
          </span>
          <span
            v-else
            class="badge badge-ghost py-3"
          >
            Past Event
          </span>
        </div>
      </div>

      <div class="mb-6">
        <VerticalTabsLayout
          v-model="activeViewTab"
          :tabs="tournamentViewTabs"
          :initial-open-tab-ids="['registration', 'map', 'venues']"
          :session-state-key="`tournament-view:${slug}`"
        >
          <template #overview>
            <div class="space-y-4">
              <div
                v-if="tournament.description"
                class="prose max-w-none"
              >
                <p class="text-lg">
                  {{ tournament.description }}
                </p>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="card bg-base-200">
                  <div class="card-body">
                    <h3 class="card-title text-base flex items-center gap-2">
                      <Icon
                        name="tabler:calendar"
                        size="20"
                      />
                      Date & Time
                    </h3>
                    <p class="text-sm">
                      {{ formatDateRange(tournament.startDate, tournament.endDate) }}
                    </p>
                  </div>
                </div>

                <div class="card bg-base-200">
                  <div class="card-body">
                    <h3 class="card-title text-base flex items-center gap-2">
                      <Icon
                        name="tabler:map-pin"
                        size="20"
                      />
                      Location
                    </h3>
                    <p class="text-sm">
                      {{ [tournament.city, tournament.country].filter(Boolean).join(", ") || "Location TBD" }}
                    </p>
                  </div>
                </div>

                <div
                  v-if="tournament.websiteUrl"
                  class="card bg-base-200"
                >
                  <div class="card-body">
                    <h3 class="card-title text-base flex items-center gap-2">
                      <Icon
                        name="tabler:world"
                        size="20"
                      />
                      Website
                    </h3>
                    <a
                      :href="tournament.websiteUrl"
                      class="link link-primary text-sm break-all"
                      target="_blank"
                      rel="noreferrer"
                    >{{ tournament.websiteUrl }}</a>
                  </div>
                </div>

                <div class="card bg-base-200">
                  <div class="card-body">
                    <div class="flex items-center justify-between gap-2">
                      <h3 class="card-title text-base flex items-center gap-2">
                        <Icon
                          name="tabler:user-plus"
                          size="20"
                        />
                        Registration
                      </h3>
                      <span
                        class="badge badge-sm"
                        :class="registrationStatusBadge.badgeClass"
                      >
                        {{ registrationStatusBadge.label }}
                      </span>
                    </div>
                    <p class="text-sm">
                      {{ formatRegistrationDateRange(tournament.registrationOpenDate, tournament.registrationCloseDate) }}
                    </p>
                    <div class="mt-2">
                      <button
                        type="button"
                        class="btn btn-primary btn-xs"
                        @click="activeViewTab = 'registration'"
                      >
                        {{ isCurrentlyRegistered ? "View / Edit My Registration" : "Go to Registration" }}
                      </button>
                    </div>
                  </div>
                </div>

                <div
                  v-if="tournament.isSanctioned"
                  class="card bg-base-200"
                >
                  <div class="card-body">
                    <h3 class="card-title text-base flex items-center gap-2">
                      <Icon
                        name="tabler:rosette-discount-check"
                        size="20"
                      />
                      Status
                    </h3>
                    <p class="text-sm">
                      Sanctioned tournament
                    </p>
                  </div>
                </div>

                <div
                  v-if="tournament.hasGolf || tournament.hasAccuracy || tournament.hasDistance || tournament.hasSCF || tournament.hasDiscathon || tournament.hasDDC || tournament.hasFreestyle"
                  class="card bg-base-200 md:col-span-2"
                >
                  <div class="card-body">
                    <h3 class="card-title text-base flex items-center gap-2">
                      <Icon
                        name="tabler:trophy"
                        size="20"
                      />
                      Event Types
                    </h3>
                    <EventTypesList
                      :has-golf="tournament.hasGolf"
                      :has-accuracy="tournament.hasAccuracy"
                      :has-distance="tournament.hasDistance"
                      :has-scf="tournament.hasSCF"
                      :has-discathon="tournament.hasDiscathon"
                      :has-ddc="tournament.hasDDC"
                      :has-freestyle="tournament.hasFreestyle"
                      size="md"
                      wrapper-class="flex flex-wrap gap-2"
                    />
                  </div>
                </div>

                <div
                  v-if="tournament.paymentInformation"
                  class="card bg-base-200 md:col-span-2"
                >
                  <div class="card-body">
                    <h3 class="card-title text-base flex items-center gap-2">
                      <Icon
                        name="tabler:credit-card"
                        size="20"
                      />
                      Payment information
                    </h3>
                    <p class="text-sm whitespace-pre-line">
                      {{ tournament.paymentInformation }}
                    </p>
                  </div>
                </div>

                <div
                  v-if="tournament.facilities"
                  class="card bg-base-200 md:col-span-2"
                >
                  <div class="card-body">
                    <h3 class="card-title text-base flex items-center gap-2">
                      <Icon
                        name="tabler:building-community"
                        size="20"
                      />
                      Facilities
                    </h3>
                    <p class="text-sm whitespace-pre-line">
                      {{ tournament.facilities }}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <template #registration>
            <div class="space-y-6">
              <!-- Registration Window Banner -->
              <div class="card bg-base-200 border border-base-300">
                <div class="card-body p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div class="flex items-center gap-2">
                      <h2
                        id="self-registration-heading"
                        class="text-lg font-bold"
                      >
                        Player Registration
                      </h2>
                      <span
                        class="badge"
                        :class="registrationStatusBadge.badgeClass"
                      >
                        {{ registrationStatusBadge.label }}
                      </span>
                    </div>
                    <p class="text-sm opacity-75 mt-1">
                      {{ formatRegistrationDateRange(tournament.registrationOpenDate, tournament.registrationCloseDate) }}
                    </p>
                  </div>

                  <div
                    v-if="isCurrentlyRegistered"
                    class="flex flex-wrap items-center gap-2"
                  >
                    <span class="badge badge-success gap-1">
                      <Icon
                        name="tabler:check"
                        size="14"
                      />
                      Registered ({{ activeEntries.length }} {{ activeEntries.length === 1 ? "discipline" : "disciplines" }})
                    </span>
                    <span
                      v-if="myRegistration?.playerNumber != null"
                      class="badge badge-outline font-mono"
                    >
                      Player #{{ myRegistration.playerNumber }}
                    </span>
                  </div>
                </div>
              </div>

              <!-- Feedback Alerts -->
              <div
                v-if="registrationError"
                role="alert"
                aria-live="polite"
                class="alert alert-error"
              >
                <Icon
                  name="tabler:alert-circle"
                  size="20"
                />
                <span>{{ registrationError }}</span>
              </div>

              <div
                v-if="registrationSuccess"
                role="status"
                aria-live="polite"
                class="alert alert-success"
              >
                <Icon
                  name="tabler:circle-check"
                  size="20"
                />
                <span>{{ registrationSuccess }}</span>
              </div>

              <!-- Guest / Unauthenticated View -->
              <div
                v-if="!myRegistration?.authenticated"
                class="card bg-base-100 border border-base-300"
              >
                <div class="card-body space-y-3">
                  <h3 class="card-title text-base">
                    Sign in to Register Online
                  </h3>
                  <p class="text-sm opacity-80">
                    Sign in with your player account to choose your division and disciplines. If you don't have an account, the Tournament Director can also register you as a guest player.
                  </p>
                  <div class="card-actions">
                    <NuxtLink
                      :to="`/signin?redirect=${encodeURIComponent(`/tournaments/${slug}`)}`"
                      class="btn btn-primary btn-sm"
                    >
                      Sign In
                    </NuxtLink>
                  </div>
                </div>
              </div>

              <!-- Signed-in Player Registration Form -->
              <form
                v-else
                aria-labelledby="self-registration-heading"
                class="card bg-base-100 border border-base-300"
                @submit.prevent="submitSelfRegistration"
              >
                <div class="card-body space-y-6">
                  <!-- Profile Details for Eligibility & Minor Divisions -->
                  <fieldset
                    class="grid grid-cols-1 sm:grid-cols-2 gap-4 border border-base-300 rounded-box p-4"
                    :disabled="!tournament.isRegistrationOpen || submittingRegistration"
                  >
                    <legend class="px-2 text-sm font-semibold">
                      1. Player Profile & Eligibility Details
                    </legend>

                    <div class="flex flex-col gap-1">
                      <label
                        for="reg-display-name"
                        class="text-sm font-medium"
                      >
                        Player Name <span aria-hidden="true">*</span>
                      </label>
                      <input
                        id="reg-display-name"
                        v-model="regDisplayName"
                        name="displayName"
                        type="text"
                        required
                        autocomplete="name"
                        class="input input-bordered w-full"
                      >
                    </div>

                    <div class="flex flex-col gap-1">
                      <label
                        for="reg-country"
                        class="text-sm font-medium"
                      >
                        Country
                      </label>
                      <input
                        id="reg-country"
                        v-model="regCountry"
                        name="country"
                        type="text"
                        autocomplete="country-name"
                        placeholder="e.g. Sweden"
                        class="input input-bordered w-full"
                      >
                    </div>

                    <div class="flex flex-col gap-1">
                      <label
                        for="reg-dob"
                        class="text-sm font-medium"
                      >
                        Date of Birth (for Age/Minor Divisions)
                      </label>
                      <input
                        id="reg-dob"
                        v-model="regDateOfBirth"
                        name="dateOfBirth"
                        type="date"
                        autocomplete="bday"
                        class="input input-bordered w-full"
                      >
                    </div>

                    <fieldset class="flex flex-col gap-2">
                      <legend class="text-sm font-medium">
                        Gender Eligibility Category
                      </legend>
                      <div class="flex items-center gap-6 pt-1">
                        <div class="flex items-center gap-2">
                          <input
                            id="reg-gender-open"
                            v-model="regGenderCategory"
                            type="radio"
                            name="genderCategory"
                            value="open"
                            class="radio radio-primary radio-sm"
                          >
                          <label
                            for="reg-gender-open"
                            class="text-sm cursor-pointer"
                          >Open / Mixed</label>
                        </div>
                        <div class="flex items-center gap-2">
                          <input
                            id="reg-gender-women"
                            v-model="regGenderCategory"
                            type="radio"
                            name="genderCategory"
                            value="women"
                            class="radio radio-primary radio-sm"
                          >
                          <label
                            for="reg-gender-women"
                            class="text-sm cursor-pointer"
                          >Women</label>
                        </div>
                      </div>
                    </fieldset>

                    <div class="flex flex-col gap-1">
                      <label
                        for="reg-pdga"
                        class="text-sm font-medium"
                      >
                        PDGA Number (optional)
                      </label>
                      <input
                        id="reg-pdga"
                        v-model="regPdgaNumber"
                        name="pdgaNumber"
                        type="text"
                        inputmode="numeric"
                        autocorrect="off"
                        autocapitalize="none"
                        spellcheck="false"
                        class="input input-bordered w-full"
                      >
                    </div>

                    <div class="flex flex-col gap-1">
                      <label
                        for="reg-home-club"
                        class="text-sm font-medium"
                      >
                        Home Club (optional)
                      </label>
                      <input
                        id="reg-home-club"
                        v-model="regHomeClub"
                        name="homeClub"
                        type="text"
                        class="input input-bordered w-full"
                      >
                    </div>
                  </fieldset>

                  <!-- Major Division Selection & Derived Minor Divisions -->
                  <fieldset
                    class="border border-base-300 rounded-box p-4 space-y-3"
                    :disabled="!tournament.isRegistrationOpen || submittingRegistration"
                  >
                    <legend class="px-2 text-sm font-semibold">
                      2. Division Selection
                    </legend>

                    <div class="flex flex-wrap gap-4">
                      <div
                        v-for="div in tournament.majorDivisions"
                        :key="div.code"
                        class="flex items-center gap-2 border border-base-300 rounded-lg px-4 py-2.5"
                      >
                        <input
                          :id="`reg-major-${div.code}`"
                          v-model="regMajorDivision"
                          type="radio"
                          name="majorDivision"
                          :value="div.code"
                          class="radio radio-primary"
                        >
                        <label
                          :for="`reg-major-${div.code}`"
                          class="font-medium cursor-pointer"
                        >
                          {{ div.label }} <span class="text-xs opacity-60">({{ div.code }})</span>
                        </label>
                      </div>
                    </div>

                    <div class="bg-base-200/70 rounded-lg p-3 text-sm flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span class="font-medium">Automatic Age / Minor Division Tags:</span>
                        <p class="text-xs opacity-70">
                          Automatically derived from your birth year and gender category.
                        </p>
                      </div>
                      <div class="flex flex-wrap gap-1.5">
                        <template v-if="previewMinorDivisions.length > 0">
                          <span
                            v-for="tag in previewMinorDivisions"
                            :key="tag"
                            class="badge badge-secondary badge-sm"
                          >
                            {{ tag }}
                          </span>
                        </template>
                        <span
                          v-else
                          class="text-xs opacity-60 italic"
                        >
                          {{ regDateOfBirth ? "No age-protected minor division applies" : "Enter Date of Birth to see eligible age divisions" }}
                        </span>
                      </div>
                    </div>
                  </fieldset>

                  <!-- Discipline Selection -->
                  <fieldset
                    class="border border-base-300 rounded-box p-4 space-y-3"
                    :disabled="!tournament.isRegistrationOpen || submittingRegistration"
                  >
                    <legend class="px-2 text-sm font-semibold">
                      3. Select Disciplines
                    </legend>

                    <div class="flex flex-wrap items-center justify-between gap-2">
                      <p class="text-xs opacity-75">
                        Choose which disciplines you want to compete in, or select all for Full Overall.
                      </p>
                      <button
                        type="button"
                        class="btn btn-xs"
                        :class="isFullOverallSelected ? 'btn-secondary' : 'btn-outline'"
                        @click="selectAllDisciplines"
                      >
                        <Icon
                          name="tabler:checks"
                          size="14"
                        />
                        Select All / Full Overall
                      </button>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                      <div
                        v-for="disc in tournament.enabledDisciplines"
                        :key="disc.key"
                        class="flex items-center gap-2.5 border border-base-300 rounded-lg px-3 py-2"
                      >
                        <input
                          :id="`reg-disc-${disc.key}`"
                          v-model="regSelectedDisciplines"
                          type="checkbox"
                          name="disciplines"
                          :value="disc.key"
                          class="checkbox checkbox-primary checkbox-sm"
                        >
                        <label
                          :for="`reg-disc-${disc.key}`"
                          class="text-sm font-medium cursor-pointer flex-1"
                        >
                          {{ disc.label }}
                        </label>
                      </div>
                    </div>
                  </fieldset>

                  <!-- Form Actions -->
                  <div class="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <div>
                      <button
                        v-if="isCurrentlyRegistered && tournament.isRegistrationOpen"
                        type="button"
                        class="btn btn-error btn-outline btn-sm"
                        :disabled="withdrawingRegistration || submittingRegistration"
                        @click="withdrawSelfRegistration"
                      >
                        <span
                          v-if="withdrawingRegistration"
                          class="loading loading-spinner loading-xs"
                        />
                        Withdraw Registration
                      </button>
                    </div>

                    <button
                      v-if="tournament.isRegistrationOpen"
                      type="submit"
                      class="btn btn-primary"
                      :disabled="submittingRegistration"
                    >
                      <span
                        v-if="submittingRegistration"
                        class="loading loading-spinner loading-xs"
                      />
                      {{ isCurrentlyRegistered ? "Update Registration" : "Confirm Registration" }}
                    </button>
                    <p
                      v-else
                      class="text-xs opacity-70 italic"
                    >
                      Online self-registration is currently closed. Please contact the Tournament Director for changes.
                    </p>
                  </div>
                </div>
              </form>
            </div>
          </template>

          <template #contacts>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div
                v-if="hasContactData"
                class="card bg-base-200"
              >
                <div class="card-body">
                  <h3 class="card-title text-base flex items-center gap-2">
                    <Icon
                      name="tabler:user"
                      size="20"
                    />
                    Tournament Contact
                  </h3>
                  <div class="text-sm space-y-1">
                    <p v-if="tournament.contactName">
                      {{ tournament.contactName }}
                    </p>
                    <p v-if="tournament.contactEmail">
                      <a
                        :href="`mailto:${tournament.contactEmail}`"
                        class="link link-primary"
                      >{{ tournament.contactEmail }}</a>
                    </p>
                    <p v-if="tournament.contactPhone">
                      {{ tournament.contactPhone }}
                    </p>
                  </div>
                </div>
              </div>

              <div
                v-if="hasDirectorData"
                class="card bg-base-200"
              >
                <div class="card-body">
                  <h3 class="card-title text-base flex items-center gap-2">
                    <Icon
                      name="tabler:user-star"
                      size="20"
                    />
                    Tournament Director
                  </h3>
                  <div class="text-sm space-y-1">
                    <p v-if="tournament.directorName">
                      {{ tournament.directorName }}
                    </p>
                    <p v-if="tournament.directorEmail">
                      <a
                        :href="`mailto:${tournament.directorEmail}`"
                        class="link link-primary"
                      >{{ tournament.directorEmail }}</a>
                    </p>
                    <p v-if="tournament.directorPhone">
                      {{ tournament.directorPhone }}
                    </p>
                  </div>
                </div>
              </div>

              <EmptyStateAlert
                v-if="!hasContactData && !hasDirectorData"
                class="md:col-span-2"
                message="No contact information is available yet."
              />
            </div>
          </template>

          <template #map>
            <div v-if="hasMapCoordinates">
              <ClientOnly>
                <TournamentMap
                  :lat="tournament.lat"
                  :long="tournament.long"
                  :name="tournament.name"
                  :city="tournament.city"
                  :country="tournament.country"
                  :venues="tournament.venues"
                />
              </ClientOnly>
            </div>
            <div
              v-else-if="tournament.city || tournament.country"
              class="alert"
            >
              <Icon
                name="tabler:map-off"
                size="24"
              />
              <div>
                <p class="font-semibold">
                  Map location not specified
                </p>
                <p class="text-sm opacity-70">
                  Coordinates haven't been set for this tournament yet. Location: {{ [tournament.city, tournament.country].filter(Boolean).join(", ") }}
                </p>
              </div>
            </div>
            <EmptyStateAlert
              v-else
              message="No location information available yet."
            />
          </template>

          <template #venues>
            <div
              v-if="tournament.venues.length > 0"
              class="space-y-4"
            >
              <div
                v-for="(venue, index) in tournament.venues"
                :key="venue.id"
                class="rounded-box bg-base-100 border border-base-300 p-4"
              >
                <VenueListItem
                  :venue="venue"
                  :title="`${venue.name} (${index + 1})`"
                  coordinates-class="text-xs opacity-70"
                />
              </div>
            </div>
            <EmptyStateAlert
              v-else
              message="No venues have been assigned to this tournament yet."
            />
          </template>
        </VerticalTabsLayout>
      </div>

      <!-- CTA for guests -->
      <div class="alert alert-info">
        <Icon
          name="tabler:info-circle"
          size="24"
        />
        <div class="flex-1">
          <p class="font-semibold">
            Interested in participating?
          </p>
          <p class="text-sm opacity-80">
            Register directly in the Registration tab, or contact the tournament director if you need assistance.
          </p>
        </div>
        <a
          v-if="tournamentDirectorEmail"
          :href="`mailto:${tournamentDirectorEmail}?subject=Tournament Participation - ${tournament.name}`"
          class="btn btn-primary btn-sm"
        >
          Contact TD
        </a>
      </div>
    </div>
  </div>
</template>
