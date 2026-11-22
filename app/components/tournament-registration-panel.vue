<script setup lang="ts">
import type { MyRegistrationResponse, TournamentRegistrationInfo } from "~/types/tournament-registration";

import { deriveMinorDivisionTags } from "#shared/utils/division-age";

const props = defineProps<{
  slug: string;
  tournament: TournamentRegistrationInfo;
  myRegistration: MyRegistrationResponse | null | undefined;
}>();

const emit = defineEmits<{
  updated: [];
}>();

const regMajorDivision = ref("OPEN");
const regSelectedDisciplines = ref<string[]>([]);
const regDisplayName = ref("");
const regCountry = ref("");
const regDateOfBirth = ref("");
const regGenderCategory = ref<"open" | "women">("open");
const regPdgaNumber = ref("");
const regHomeClub = ref("");

const submitting = ref(false);
const withdrawing = ref(false);
const errorMessage = ref<string | null>(null);
const successMessage = ref<string | null>(null);

const activeEntries = computed(() =>
  (props.myRegistration?.entries ?? []).filter(entry => entry.status === "registered"),
);
const isCurrentlyRegistered = computed(() => activeEntries.value.length > 0);
const statusBadge = computed(() => getRegistrationStatusBadge(props.tournament.registrationStatusReason));
const isFormDisabled = computed(() => !props.tournament.isRegistrationOpen || submitting.value);

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

const registrationWindowLabel = computed(() =>
  formatRegistrationWindow(props.tournament.registrationOpenDate, props.tournament.registrationCloseDate, formatDate),
);

function syncFormFromData() {
  const profile = props.myRegistration?.profile;
  if (profile) {
    regDisplayName.value = profile.displayName || "";
    regCountry.value = profile.country || "";
    regDateOfBirth.value = profile.dateOfBirth || "";
    regGenderCategory.value = profile.genderCategory || "open";
    regPdgaNumber.value = profile.pdgaNumber || "";
    regHomeClub.value = profile.homeClub || "";
  }

  const defaultDivision = props.tournament.majorDivisions[0]?.code || "OPEN";
  if (activeEntries.value.length > 0) {
    regMajorDivision.value = activeEntries.value[0]?.majorDivision || defaultDivision;
    regSelectedDisciplines.value = activeEntries.value.map(entry => entry.discipline);
  }
  else {
    regMajorDivision.value = defaultDivision;
    regSelectedDisciplines.value = props.tournament.enabledDisciplines.map(d => d.key);
  }
}

watch(
  [() => props.myRegistration, () => props.tournament],
  syncFormFromData,
  { immediate: true },
);

// Live preview uses the exact same derivation as the server, with the tournament's policy
const previewMinorDivisions = computed(() =>
  deriveMinorDivisionTags(
    { dateOfBirth: regDateOfBirth.value, genderCategory: regGenderCategory.value },
    props.tournament.startDate,
    props.tournament.divisionAgePolicy,
  ).minorDivisionTags,
);

const isFullOverallSelected = computed(() => {
  const enabled = props.tournament.enabledDisciplines;
  return enabled.length > 0 && enabled.every(d => regSelectedDisciplines.value.includes(d.key));
});

function selectAllDisciplines() {
  regSelectedDisciplines.value = props.tournament.enabledDisciplines.map(d => d.key);
  errorMessage.value = null;
}

async function submitRegistration() {
  if (submitting.value) {
    return;
  }

  errorMessage.value = null;
  successMessage.value = null;

  if (regSelectedDisciplines.value.length === 0) {
    errorMessage.value = "Please select at least one discipline to enter.";
    return;
  }

  const wasRegistered = isCurrentlyRegistered.value;
  submitting.value = true;
  try {
    await $fetch(`/api/tournaments/${props.slug}/entries`, {
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
    successMessage.value = wasRegistered
      ? "Your registration has been updated."
      : "You are registered for this tournament.";
    emit("updated");
  }
  catch (error) {
    errorMessage.value = getApiErrorMessage(error, "Failed to save registration.");
  }
  finally {
    submitting.value = false;
  }
}

async function withdrawRegistration() {
  const playerId = props.myRegistration?.profile?.playerId;
  if (!playerId || withdrawing.value) {
    return;
  }

  errorMessage.value = null;
  successMessage.value = null;
  withdrawing.value = true;

  try {
    await $fetch(`/api/tournaments/${props.slug}/entries/${playerId}`, {
      method: "PATCH",
      body: { status: "withdrawn" },
    });
    successMessage.value = "You have withdrawn from this tournament.";
    emit("updated");
  }
  catch (error) {
    errorMessage.value = getApiErrorMessage(error, "Failed to withdraw registration.");
  }
  finally {
    withdrawing.value = false;
  }
}
</script>

<template>
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
              :class="statusBadge.badgeClass"
            >
              {{ statusBadge.label }}
            </span>
          </div>
          <p class="text-sm opacity-75 mt-1">
            {{ registrationWindowLabel }}
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

    <!-- Feedback -->
    <div
      v-if="errorMessage"
      role="alert"
      aria-live="polite"
      class="alert alert-error"
    >
      <Icon
        name="tabler:alert-circle"
        size="20"
      />
      <span>{{ errorMessage }}</span>
    </div>

    <div
      v-if="successMessage"
      role="status"
      aria-live="polite"
      class="alert alert-success"
    >
      <Icon
        name="tabler:circle-check"
        size="20"
      />
      <span>{{ successMessage }}</span>
    </div>

    <!-- Guest / Unauthenticated -->
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
            :to="{ path: '/signin', query: { redirect: `/tournaments/${slug}` } }"
            class="btn btn-primary btn-sm"
          >
            Sign In
          </NuxtLink>
        </div>
      </div>
    </div>

    <!-- Signed-in Registration Form -->
    <form
      v-else
      aria-labelledby="self-registration-heading"
      class="card bg-base-100 border border-base-300"
      @submit.prevent="submitRegistration"
    >
      <div class="card-body space-y-6">
        <fieldset
          class="grid grid-cols-1 sm:grid-cols-2 gap-4 border border-base-300 rounded-box p-4"
          :disabled="isFormDisabled"
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

        <fieldset
          class="border border-base-300 rounded-box p-4 space-y-3"
          :disabled="isFormDisabled"
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
                Automatically derived from your date of birth and gender category.
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

        <fieldset
          class="border border-base-300 rounded-box p-4 space-y-3"
          :disabled="isFormDisabled"
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

        <div class="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div>
            <button
              v-if="isCurrentlyRegistered && tournament.isRegistrationOpen"
              type="button"
              class="btn btn-error btn-outline btn-sm"
              :disabled="withdrawing || submitting"
              @click="withdrawRegistration"
            >
              <span
                v-if="withdrawing"
                class="loading loading-spinner loading-xs"
              />
              Withdraw Registration
            </button>
          </div>

          <button
            v-if="tournament.isRegistrationOpen"
            type="submit"
            class="btn btn-primary"
            :disabled="submitting"
          >
            <span
              v-if="submitting"
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
