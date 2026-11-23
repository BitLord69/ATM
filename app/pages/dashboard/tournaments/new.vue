<script setup lang="ts">
import { useTournamentStore } from "~/stores/tournament";
import { getCountryCoordinates } from "~/utils/country-coordinates";

definePageMeta({
  ssr: false,
});

const tournamentStore = useTournamentStore();
const authStore = useAuthStore();

type OrganizationOption = {
  id: string;
  name: string;
};

const { data: organizationsData } = await useFetch<OrganizationOption[]>("/api/organizations", {
  default: () => [],
});

const wizardSteps = [
  { id: 1, label: "Basics" },
  { id: 2, label: "Dates" },
  { id: 3, label: "Events & divisions" },
  { id: 4, label: "Review" },
] as const;

const currentStep = ref<1 | 2 | 3 | 4>(1);
const nextStepLabel = computed(() => wizardSteps.find(step => step.id === currentStep.value + 1)?.label ?? "");
const stepHeadingRef = ref<HTMLHeadingElement | null>(null);

const name = ref("");
const description = ref("");
const orgMode = ref<"existing" | "new">("existing");
const selectedOrganizationId = ref("");
const organizationName = ref("");
const city = ref("");
const country = ref(authStore.currentUser?.country || "");
const startDate = ref("");
const endDate = ref("");
const registrationOpenDate = ref("");
const registrationCloseDate = ref("");

const divisionOpen = ref(true);
const divisionWomen = ref(true);
const divisionMaster = ref(false);
const divisionGrandMaster = ref(false);
const divisionSeniorGrandMaster = ref(false);
const divisionLegend = ref(false);
const divisionJunior = ref(false);

const hasGolf = ref(true);
const hasAccuracy = ref(false);
const hasDistance = ref(false);
const hasSCF = ref(false);
const hasDiscathon = ref(false);
const hasDDC = ref(false);
const hasFreestyle = ref(false);

const submitting = ref(false);
const errorMessage = ref<string | null>(null);

const hasExistingOrganizations = computed(() => (organizationsData.value?.length ?? 0) > 0);
const organizationOptions = computed(() =>
  (organizationsData.value ?? []).map(org => ({
    value: org.id,
    label: org.name,
  })),
);

watch(
  organizationsData,
  (orgs) => {
    if (!orgs || orgs.length === 0) {
      orgMode.value = "new";
    }
  },
  { immediate: true },
);

watch(startDate, (newStart, oldStart) => {
  if (newStart && (!endDate.value || endDate.value < newStart || endDate.value === oldStart)) {
    endDate.value = newStart;
  }
});

watch(registrationOpenDate, (newOpen, oldOpen) => {
  if (newOpen && (!registrationCloseDate.value || registrationCloseDate.value < newOpen || registrationCloseDate.value === oldOpen)) {
    registrationCloseDate.value = newOpen;
  }
});

const selectedDisciplineLabels = computed(() => {
  const list: string[] = [];
  if (hasGolf.value)
    list.push("Disc Golf");
  if (hasAccuracy.value)
    list.push("Accuracy");
  if (hasDistance.value)
    list.push("Distance");
  if (hasSCF.value)
    list.push("SCF");
  if (hasDiscathon.value)
    list.push("Discathon");
  if (hasDDC.value)
    list.push("DDC");
  if (hasFreestyle.value)
    list.push("Freestyle");
  return list;
});

const selectedDivisionLabels = computed(() => {
  const list: string[] = [];
  if (divisionOpen.value)
    list.push("Open (MPO)");
  if (divisionWomen.value)
    list.push("Women (FPO)");
  if (divisionMaster.value)
    list.push("Master (40+)");
  if (divisionGrandMaster.value)
    list.push("Grand Master (50+)");
  if (divisionSeniorGrandMaster.value)
    list.push("Senior Grand Master (60+)");
  if (divisionLegend.value)
    list.push("Legend (70+)");
  if (divisionJunior.value)
    list.push("Junior (≤18)");
  return list;
});

const resolvedOrganizationSummary = computed(() => {
  if (orgMode.value === "existing" && hasExistingOrganizations.value) {
    const found = organizationsData.value?.find(org => org.id === selectedOrganizationId.value);
    if (found) {
      return found.name;
    }
  }
  if (organizationName.value.trim()) {
    return `${organizationName.value.trim()} (new)`;
  }
  return "Auto-created personal organization";
});

function selectAllDisciplines() {
  hasGolf.value = true;
  hasAccuracy.value = true;
  hasDistance.value = true;
  hasSCF.value = true;
  hasDiscathon.value = true;
  hasDDC.value = true;
  hasFreestyle.value = true;
}

function selectAllDivisions() {
  divisionOpen.value = true;
  divisionWomen.value = true;
  divisionMaster.value = true;
  divisionGrandMaster.value = true;
  divisionSeniorGrandMaster.value = true;
  divisionLegend.value = true;
  divisionJunior.value = true;
}

function validateStep(step: number): boolean {
  errorMessage.value = null;
  if (step === 1 && name.value.trim().length < 3) {
    errorMessage.value = "Tournament name must be at least 3 characters.";
    return false;
  }
  if (step === 2) {
    if (startDate.value && endDate.value && endDate.value < startDate.value) {
      errorMessage.value = "End date cannot be before start date.";
      return false;
    }
    if (registrationOpenDate.value && registrationCloseDate.value && registrationCloseDate.value < registrationOpenDate.value) {
      errorMessage.value = "Registration close date cannot be before open date.";
      return false;
    }
  }
  return true;
}

async function focusStepHeading() {
  await nextTick();
  stepHeadingRef.value?.focus();
}

async function goToStep(target: 1 | 2 | 3 | 4) {
  if (target > currentStep.value) {
    for (let s = currentStep.value; s < target; s += 1) {
      if (!validateStep(s)) {
        return;
      }
    }
  }
  errorMessage.value = null;
  currentStep.value = target;
  await focusStepHeading();
}

async function nextStep() {
  if (!validateStep(currentStep.value)) {
    return;
  }
  if (currentStep.value < 4) {
    currentStep.value = (currentStep.value + 1) as 1 | 2 | 3 | 4;
    await focusStepHeading();
  }
}

async function prevStep() {
  errorMessage.value = null;
  if (currentStep.value > 1) {
    currentStep.value = (currentStep.value - 1) as 1 | 2 | 3 | 4;
    await focusStepHeading();
  }
}

function dateInputToTimestamp(value: string): number | null {
  if (!value.trim()) {
    return null;
  }
  const parsed = Date.parse(`${value}T00:00:00Z`);
  return Number.isNaN(parsed) ? null : parsed;
}

async function handleFormSubmit() {
  if (currentStep.value < 4) {
    await nextStep();
    return;
  }
  await createTournament();
}

async function createTournament() {
  if (submitting.value || !validateStep(1) || !validateStep(2)) {
    return;
  }

  // Only send country centroid fallback when no city is entered; otherwise let the server geocode city + country.
  const coords = !city.value.trim() && country.value.trim()
    ? getCountryCoordinates(country.value.trim())
    : null;

  submitting.value = true;
  try {
    const response = await $fetch<{ success: boolean; tournament: { id: number; slug: string; name: string } }>("/api/tournaments", {
      method: "POST",
      body: {
        name: name.value.trim(),
        description: description.value.trim() || null,
        country: country.value.trim() || null,
        city: city.value.trim() || null,
        lat: coords?.[0] ?? 0,
        long: coords?.[1] ?? 0,
        startDate: dateInputToTimestamp(startDate.value),
        endDate: dateInputToTimestamp(endDate.value),
        registrationOpenDate: dateInputToTimestamp(registrationOpenDate.value),
        registrationCloseDate: dateInputToTimestamp(registrationCloseDate.value),
        organizationId: orgMode.value === "existing" ? (selectedOrganizationId.value || null) : null,
        organizationName: orgMode.value === "new" ? (organizationName.value.trim() || null) : null,
        divisionOpen: divisionOpen.value,
        divisionWomen: divisionWomen.value,
        divisionMaster: divisionMaster.value,
        divisionGrandMaster: divisionGrandMaster.value,
        divisionSeniorGrandMaster: divisionSeniorGrandMaster.value,
        divisionLegend: divisionLegend.value,
        divisionJunior: divisionJunior.value,
        hasGolf: hasGolf.value,
        hasAccuracy: hasAccuracy.value,
        hasDistance: hasDistance.value,
        hasSCF: hasSCF.value,
        hasDiscathon: hasDiscathon.value,
        hasDDC: hasDDC.value,
        hasFreestyle: hasFreestyle.value,
      },
    });

    await tournamentStore.loadTournaments();
    await navigateTo(`/dashboard/tournaments/${response.tournament.slug}/edit`);
  }
  catch (error: unknown) {
    errorMessage.value = getApiErrorMessage(error, "Failed to create tournament.");
  }
  finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="container mx-auto max-w-3xl p-4 md:p-6 space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h1
          id="create-tournament-heading"
          class="text-2xl md:text-3xl font-bold"
        >
          Create a new tournament
        </h1>
        <p class="text-sm opacity-75 mt-1">
          Set up the basics step by step — you can fine-tune venues, pools, and schedules right after.
        </p>
      </div>
      <NuxtLink
        to="/dashboard/tournaments"
        class="btn btn-ghost btn-sm"
      >
        Back to workspace
      </NuxtLink>
    </div>

    <!-- DaisyUI Steps Progress Indicator -->
    <nav aria-label="Tournament creation progress">
      <ul class="steps steps-horizontal w-full">
        <li
          v-for="step in wizardSteps"
          :key="step.id"
          class="step cursor-pointer"
          :class="{ 'step-primary': currentStep >= step.id }"
          :aria-current="currentStep === step.id ? 'step' : undefined"
          @click="goToStep(step.id)"
        >
          <span class="text-xs sm:text-sm font-medium">{{ step.label }}</span>
        </li>
      </ul>
    </nav>

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

    <form
      aria-labelledby="create-tournament-heading"
      class="card bg-base-200 border border-base-300 shadow-sm"
      @submit.prevent="handleFormSubmit"
    >
      <div class="card-body space-y-6">
        <!-- Step 1: Basic Information -->
        <section
          v-if="currentStep === 1"
          class="space-y-4 bg-base-100 border border-base-300 rounded-box p-5"
        >
          <h2
            ref="stepHeadingRef"
            tabindex="-1"
            class="text-lg font-semibold focus:outline-none"
          >
            Step 1: Basic information & location
          </h2>

          <div class="flex flex-col gap-1">
            <label
              for="new-tournament-name"
              class="text-sm font-medium"
            >
              Tournament name <span aria-hidden="true">*</span>
            </label>
            <input
              id="new-tournament-name"
              v-model="name"
              name="name"
              type="text"
              required
              minlength="3"
              maxlength="120"
              enterkeyhint="next"
              placeholder="e.g. Swedish Overall Open 2026"
              class="input input-bordered w-full"
            >
          </div>

          <div class="flex flex-col gap-1">
            <label
              for="new-tournament-description"
              class="text-sm font-medium"
            >
              Description <span class="text-xs font-normal opacity-60">(optional)</span>
            </label>
            <textarea
              id="new-tournament-description"
              v-model="description"
              name="description"
              rows="3"
              placeholder="Short overview of your event..."
              class="textarea textarea-bordered w-full"
            />
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="flex flex-col gap-1">
              <label
                for="new-tournament-city"
                class="text-sm font-medium"
              >
                City
              </label>
              <input
                id="new-tournament-city"
                v-model="city"
                name="city"
                type="text"
                enterkeyhint="next"
                placeholder="e.g. Ängelholm"
                class="input input-bordered w-full"
              >
            </div>

            <div class="flex flex-col gap-1">
              <label
                for="new-tournament-country"
                class="text-sm font-medium"
              >
                Country
              </label>
              <CountrySelect
                id="new-tournament-country"
                v-model="country"
                placeholder="Select or search country..."
              />
            </div>
          </div>

          <div class="flex flex-col gap-2 pt-1">
            <label
              :for="orgMode === 'existing' && hasExistingOrganizations ? 'new-tournament-org-search' : 'new-tournament-org-name'"
              class="text-sm font-medium"
            >
              Hosting club / organization <span class="text-xs font-normal opacity-60">(optional)</span>
            </label>

            <div
              v-if="hasExistingOrganizations && orgMode === 'existing'"
              class="join w-full items-stretch"
            >
              <div class="flex-1 min-w-0">
                <SearchableSelect
                  id="new-tournament-org-search"
                  v-model="selectedOrganizationId"
                  :options="organizationOptions"
                  input-class="join-item h-10"
                  placeholder="Select or search existing club/organization..."
                  empty-text="No matching clubs — click + New"
                />
              </div>
              <div class="indicator">
                <span class="indicator-item badge badge-secondary badge-xs">
                  {{ organizationOptions.length }}
                </span>
                <button
                  type="button"
                  class="btn btn-primary join-item rounded-r-full h-10 min-h-0 py-0 shadow-none gap-1"
                  @click="orgMode = 'new'"
                >
                  <Icon
                    name="tabler:plus"
                    size="16"
                  />
                  New
                </button>
              </div>
            </div>

            <div
              v-else
              class="join w-full items-stretch"
            >
              <input
                id="new-tournament-org-name"
                v-model="organizationName"
                name="organizationName"
                type="text"
                placeholder="e.g. Järva Discgolf Club (leave blank to auto-create)"
                class="input input-bordered join-item h-10 w-full"
              >
              <button
                v-if="hasExistingOrganizations"
                type="button"
                class="btn btn-outline join-item rounded-r-full h-10 min-h-0 py-0 shadow-none"
                @click="orgMode = 'existing'"
              >
                Use existing
              </button>
            </div>
          </div>
        </section>

        <!-- Step 2: Dates & registration window -->
        <section
          v-else-if="currentStep === 2"
          class="space-y-4 bg-base-100 border border-base-300 rounded-box p-5"
        >
          <h2
            ref="stepHeadingRef"
            tabindex="-1"
            class="text-lg font-semibold focus:outline-none"
          >
            Step 2: Dates & registration window
          </h2>
          <p class="text-xs opacity-70">
            All dates are optional right now and can be adjusted later in tournament details.
          </p>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="flex flex-col gap-1">
              <label
                for="new-start-date"
                class="text-sm font-medium"
              >
                Start date
              </label>
              <input
                id="new-start-date"
                v-model="startDate"
                name="startDate"
                type="date"
                class="input input-bordered w-full"
              >
            </div>

            <div class="flex flex-col gap-1">
              <label
                for="new-end-date"
                class="text-sm font-medium"
              >
                End date
              </label>
              <input
                id="new-end-date"
                v-model="endDate"
                name="endDate"
                type="date"
                :min="startDate || undefined"
                class="input input-bordered w-full"
              >
            </div>

            <div class="flex flex-col gap-1">
              <label
                for="new-reg-open"
                class="text-sm font-medium"
              >
                Registration opens
              </label>
              <input
                id="new-reg-open"
                v-model="registrationOpenDate"
                name="registrationOpenDate"
                type="date"
                class="input input-bordered w-full"
              >
            </div>

            <div class="flex flex-col gap-1">
              <label
                for="new-reg-close"
                class="text-sm font-medium"
              >
                Registration closes
              </label>
              <input
                id="new-reg-close"
                v-model="registrationCloseDate"
                name="registrationCloseDate"
                type="date"
                :min="registrationOpenDate || undefined"
                class="input input-bordered w-full"
              >
            </div>
          </div>
        </section>

        <!-- Step 3: Disciplines & divisions -->
        <section
          v-else-if="currentStep === 3"
          class="space-y-4 bg-base-100 border border-base-300 rounded-box p-5"
        >
          <h2
            ref="stepHeadingRef"
            tabindex="-1"
            class="text-lg font-semibold focus:outline-none"
          >
            Step 3: Disciplines & divisions
          </h2>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <fieldset class="border border-base-300 rounded-box p-4 space-y-2">
              <legend class="px-2 text-sm font-semibold">
                Disciplines
              </legend>

              <div class="pb-1">
                <button
                  type="button"
                  class="btn btn-xs btn-outline gap-1"
                  @click="selectAllDisciplines"
                >
                  <Icon
                    name="tabler:checks"
                    size="14"
                  />
                  Select all (full overall)
                </button>
              </div>

              <div class="flex items-center gap-2">
                <input
                  id="disc-golf"
                  v-model="hasGolf"
                  type="checkbox"
                  class="checkbox checkbox-primary checkbox-sm"
                >
                <label
                  for="disc-golf"
                  class="text-sm cursor-pointer"
                >Disc Golf</label>
              </div>
              <div class="flex items-center gap-2">
                <input
                  id="disc-accuracy"
                  v-model="hasAccuracy"
                  type="checkbox"
                  class="checkbox checkbox-primary checkbox-sm"
                >
                <label
                  for="disc-accuracy"
                  class="text-sm cursor-pointer"
                >Accuracy</label>
              </div>
              <div class="flex items-center gap-2">
                <input
                  id="disc-distance"
                  v-model="hasDistance"
                  type="checkbox"
                  class="checkbox checkbox-primary checkbox-sm"
                >
                <label
                  for="disc-distance"
                  class="text-sm cursor-pointer"
                >Distance</label>
              </div>
              <div class="flex items-center gap-2">
                <input
                  id="disc-scf"
                  v-model="hasSCF"
                  type="checkbox"
                  class="checkbox checkbox-primary checkbox-sm"
                >
                <label
                  for="disc-scf"
                  class="text-sm cursor-pointer"
                >Self-Caught Flight (SCF)</label>
              </div>
              <div class="flex items-center gap-2">
                <input
                  id="disc-discathon"
                  v-model="hasDiscathon"
                  type="checkbox"
                  class="checkbox checkbox-primary checkbox-sm"
                >
                <label
                  for="disc-discathon"
                  class="text-sm cursor-pointer"
                >Discathon</label>
              </div>
              <div class="flex items-center gap-2">
                <input
                  id="disc-ddc"
                  v-model="hasDDC"
                  type="checkbox"
                  class="checkbox checkbox-primary checkbox-sm"
                >
                <label
                  for="disc-ddc"
                  class="text-sm cursor-pointer"
                >Double Disc Court (DDC)</label>
              </div>
              <div class="flex items-center gap-2">
                <input
                  id="disc-freestyle"
                  v-model="hasFreestyle"
                  type="checkbox"
                  class="checkbox checkbox-primary checkbox-sm"
                >
                <label
                  for="disc-freestyle"
                  class="text-sm cursor-pointer"
                >Freestyle</label>
              </div>
            </fieldset>

            <fieldset class="border border-base-300 rounded-box p-4 space-y-2">
              <legend class="px-2 text-sm font-semibold">
                Divisions
              </legend>

              <div class="pb-1">
                <button
                  type="button"
                  class="btn btn-xs btn-outline gap-1"
                  @click="selectAllDivisions"
                >
                  <Icon
                    name="tabler:checks"
                    size="14"
                  />
                  Select all divisions
                </button>
              </div>

              <div class="flex items-center gap-2">
                <input
                  id="div-open"
                  v-model="divisionOpen"
                  type="checkbox"
                  class="checkbox checkbox-primary checkbox-sm"
                >
                <label
                  for="div-open"
                  class="text-sm cursor-pointer"
                >Open (MPO)</label>
              </div>
              <div class="flex items-center gap-2">
                <input
                  id="div-women"
                  v-model="divisionWomen"
                  type="checkbox"
                  class="checkbox checkbox-primary checkbox-sm"
                >
                <label
                  for="div-women"
                  class="text-sm cursor-pointer"
                >Women (FPO)</label>
              </div>
              <div class="flex items-center gap-2">
                <input
                  id="div-master"
                  v-model="divisionMaster"
                  type="checkbox"
                  class="checkbox checkbox-primary checkbox-sm"
                >
                <label
                  for="div-master"
                  class="text-sm cursor-pointer"
                >Master (40+)</label>
              </div>
              <div class="flex items-center gap-2">
                <input
                  id="div-gm"
                  v-model="divisionGrandMaster"
                  type="checkbox"
                  class="checkbox checkbox-primary checkbox-sm"
                >
                <label
                  for="div-gm"
                  class="text-sm cursor-pointer"
                >Grand Master (50+)</label>
              </div>
              <div class="flex items-center gap-2">
                <input
                  id="div-sgm"
                  v-model="divisionSeniorGrandMaster"
                  type="checkbox"
                  class="checkbox checkbox-primary checkbox-sm"
                >
                <label
                  for="div-sgm"
                  class="text-sm cursor-pointer"
                >Senior Grand Master (60+)</label>
              </div>
              <div class="flex items-center gap-2">
                <input
                  id="div-legend"
                  v-model="divisionLegend"
                  type="checkbox"
                  class="checkbox checkbox-primary checkbox-sm"
                >
                <label
                  for="div-legend"
                  class="text-sm cursor-pointer"
                >Legend (70+)</label>
              </div>
              <div class="flex items-center gap-2">
                <input
                  id="div-junior"
                  v-model="divisionJunior"
                  type="checkbox"
                  class="checkbox checkbox-primary checkbox-sm"
                >
                <label
                  for="div-junior"
                  class="text-sm cursor-pointer"
                >Junior (≤18)</label>
              </div>
            </fieldset>
          </div>
        </section>

        <!-- Step 4: Review & create -->
        <section
          v-else
          class="space-y-4 bg-base-100 border border-base-300 rounded-box p-5"
        >
          <h2
            ref="stepHeadingRef"
            tabindex="-1"
            class="text-lg font-semibold focus:outline-none"
          >
            Step 4: Review & create
          </h2>

          <dl class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div class="bg-base-200/70 rounded-lg p-3">
              <dt class="text-xs uppercase tracking-wide opacity-65">
                Tournament name
              </dt>
              <dd class="font-semibold mt-0.5">
                {{ name.trim() }}
              </dd>
            </div>
            <div class="bg-base-200/70 rounded-lg p-3">
              <dt class="text-xs uppercase tracking-wide opacity-65">
                Location
              </dt>
              <dd class="font-medium mt-0.5">
                {{ [city.trim(), country.trim()].filter(Boolean).join(", ") || "TBD" }}
              </dd>
            </div>
            <div class="bg-base-200/70 rounded-lg p-3">
              <dt class="text-xs uppercase tracking-wide opacity-65">
                Organization
              </dt>
              <dd class="font-medium mt-0.5">
                {{ resolvedOrganizationSummary }}
              </dd>
            </div>
            <div class="bg-base-200/70 rounded-lg p-3">
              <dt class="text-xs uppercase tracking-wide opacity-65">
                Dates
              </dt>
              <dd class="font-medium mt-0.5">
                {{ startDate ? (endDate && endDate !== startDate ? `${startDate} → ${endDate}` : startDate) : "TBD" }}
              </dd>
            </div>
            <div class="bg-base-200/70 rounded-lg p-3 sm:col-span-2">
              <dt class="text-xs uppercase tracking-wide opacity-65">
                Disciplines
              </dt>
              <dd class="flex flex-wrap gap-1.5 mt-1">
                <span
                  v-for="disc in selectedDisciplineLabels"
                  :key="disc"
                  class="badge badge-primary badge-sm"
                >
                  {{ disc }}
                </span>
                <span
                  v-if="selectedDisciplineLabels.length === 0"
                  class="opacity-60 italic"
                >None selected yet</span>
              </dd>
            </div>
            <div class="bg-base-200/70 rounded-lg p-3 sm:col-span-2">
              <dt class="text-xs uppercase tracking-wide opacity-65">
                Divisions
              </dt>
              <dd class="flex flex-wrap gap-1.5 mt-1">
                <span
                  v-for="div in selectedDivisionLabels"
                  :key="div"
                  class="badge badge-secondary badge-sm"
                >
                  {{ div }}
                </span>
              </dd>
            </div>
          </dl>
        </section>

        <!-- Wizard Navigation Actions -->
        <div class="flex items-center justify-between gap-2 pt-2">
          <div>
            <button
              v-if="currentStep > 1"
              type="button"
              class="btn btn-ghost"
              enterkeyhint="previous"
              :disabled="submitting"
              @click="prevStep"
            >
              Previous
            </button>
            <NuxtLink
              v-else
              to="/dashboard/tournaments"
              class="btn btn-ghost"
            >
              Cancel
            </NuxtLink>
          </div>

          <button
            v-if="currentStep < 4"
            type="submit"
            class="btn btn-primary"
            enterkeyhint="next"
          >
            Next: {{ nextStepLabel }}
          </button>
          <button
            v-else
            type="submit"
            class="btn btn-primary"
            enterkeyhint="done"
            :disabled="submitting"
          >
            <span
              v-if="submitting"
              class="loading loading-spinner loading-xs"
            />
            Create tournament
          </button>
        </div>
      </div>
    </form>
  </div>
</template>
