<script setup lang="ts">
type StartingListLockState = {
  isLocked: boolean;
  lockedBy: string | null;
  lockedAt: number | null;
};

type StartingListEntryView = {
  id: string;
  eventEntryId: string;
  discipline: string;
  roundNumber: number;
  position: number;
  activeCompetitiveDivisionSnapshot: string;
  playerName: string | null;
  userCountry?: string | null;
};

type StartingListResponse = {
  tournamentId: number;
  discipline: string;
  roundNumber: number;
  lock: StartingListLockState;
  entries: StartingListEntryView[];
};

definePageMeta({ ssr: false, layout: "tournament-admin" });

const route = useRoute();
const slug = computed(() => route.params.slug as string);

const { data, pending, error } = await useFetch(() => `/api/tournaments/${slug.value}/edit`);

if (error.value) {
  throw createError({
    statusCode: error.value.statusCode || 404,
    message: error.value.message || "Tournament not found",
  });
}

const disciplineOptions = computed(() => {
  const tournament = data.value;
  if (!tournament || Array.isArray(tournament)) {
    return [{ value: "overall", label: "Overall" }];
  }

  const options: Array<{ value: string; label: string }> = [{ value: "overall", label: "Overall" }];

  if (tournament.hasGolf) {
    options.push({ value: "golf", label: "Disc Golf" });
  }
  if (tournament.hasAccuracy) {
    options.push({ value: "accuracy", label: "Accuracy" });
  }
  if (tournament.hasDistance) {
    options.push({ value: "distance", label: "Distance" });
  }
  if (tournament.hasSCF) {
    options.push({ value: "scf", label: "SCF" });
  }
  if (tournament.hasDiscathon) {
    options.push({ value: "discathon", label: "Discathon" });
  }
  if (tournament.hasDDC) {
    options.push({ value: "ddc", label: "DDC" });
  }
  if (tournament.hasFreestyle) {
    options.push({ value: "freestyle", label: "Freestyle" });
  }

  return options;
});

const selectedDiscipline = ref("overall");
const selectedRoundNumber = ref(1);
const state = ref<StartingListResponse | null>(null);
const loading = ref(false);
const busy = ref(false);
const errorMessage = ref<string | null>(null);
const successMessage = ref<string | null>(null);
const selectedDivision = ref("all");
const groupMode = ref<"division" | "country" | "none">("division");

function getApiErrorStatus(fetchError: any) {
  return Number(fetchError?.statusCode || fetchError?.status || fetchError?.data?.statusCode || 0) || 0;
}

function getApiErrorMessage(fetchError: any, fallback: string) {
  return fetchError?.data?.message || fetchError?.message || fallback;
}

function formatTimestamp(timestamp: number | null | undefined) {
  if (!timestamp) {
    return "—";
  }
  return new Date(timestamp).toLocaleString();
}

const hasEntries = computed(() => (state.value?.entries.length ?? 0) > 0);
const isLocked = computed(() => !!state.value?.lock?.isLocked);

const orderedEntries = computed(() => {
  const entries = state.value?.entries ?? [];
  return [...entries].sort((left, right) => left.position - right.position);
});

const divisionOptions = computed(() => {
  const divisions = new Set(
    orderedEntries.value
      .map(entry => entry.activeCompetitiveDivisionSnapshot?.trim())
      .filter((division): division is string => !!division),
  );

  return [
    { value: "all", label: "All divisions" },
    ...[...divisions]
      .sort((left, right) => left.localeCompare(right))
      .map(division => ({ value: division, label: division })),
  ];
});

const visibleEntries = computed(() => {
  if (selectedDivision.value === "all") {
    return orderedEntries.value;
  }

  return orderedEntries.value.filter(
    entry => entry.activeCompetitiveDivisionSnapshot === selectedDivision.value,
  );
});

const groupedEntries = computed(() => {
  if (groupMode.value === "none") {
    return [
      {
        key: "all",
        label: "All visible entries",
        entries: visibleEntries.value,
      },
    ];
  }

  const groups = new Map<string, StartingListEntryView[]>();
  for (const entry of visibleEntries.value) {
    const key = groupMode.value === "country"
      ? (entry.userCountry || "Unassigned country")
      : (entry.activeCompetitiveDivisionSnapshot || "Unassigned division");
    const existing = groups.get(key) ?? [];
    existing.push(entry);
    groups.set(key, existing);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([label, entries]) => ({
      key: label,
      label,
      entries,
    }));
});

async function loadStartingList() {
  loading.value = true;
  errorMessage.value = null;
  try {
    state.value = await $fetch<StartingListResponse>(`/api/tournaments/${slug.value}/starting-lists`, {
      query: {
        discipline: selectedDiscipline.value,
        roundNumber: selectedRoundNumber.value,
      },
    });
  }
  catch (fetchError: any) {
    errorMessage.value = getApiErrorMessage(fetchError, "Failed to load starting list.");
  }
  finally {
    loading.value = false;
  }
}

async function setLock(locked: boolean) {
  busy.value = true;
  errorMessage.value = null;
  successMessage.value = null;
  try {
    await $fetch(`/api/tournaments/${slug.value}/starting-lists/lock`, {
      method: "POST",
      query: {
        discipline: selectedDiscipline.value,
        roundNumber: selectedRoundNumber.value,
      },
      body: { locked },
    });
    successMessage.value = locked ? "Starting list locked." : "Starting list unlocked.";
    await loadStartingList();
  }
  catch (fetchError: any) {
    errorMessage.value = getApiErrorMessage(fetchError, "Failed to update starting list lock.");
  }
  finally {
    busy.value = false;
  }
}

async function generate(overwrite = false) {
  busy.value = true;
  errorMessage.value = null;
  successMessage.value = null;
  try {
    await $fetch(`/api/tournaments/${slug.value}/starting-lists/generate`, {
      method: "POST",
      body: {
        discipline: selectedDiscipline.value,
        roundNumber: selectedRoundNumber.value,
        overwrite,
      },
    });
    successMessage.value = overwrite ? "Starting list regenerated." : "Starting list generated.";
    await loadStartingList();
  }
  catch (fetchError: any) {
    const status = getApiErrorStatus(fetchError);
    if (status === 409) {
      errorMessage.value = "Starting list already exists. Use Regenerate to overwrite.";
    }
    else if (status === 423) {
      errorMessage.value = "Starting list is locked. Unlock it before generating.";
    }
    else {
      errorMessage.value = getApiErrorMessage(fetchError, "Failed to generate starting list.");
    }
  }
  finally {
    busy.value = false;
  }
}

watch(disciplineOptions, (options) => {
  if (!options.some(option => option.value === selectedDiscipline.value)) {
    selectedDiscipline.value = options[0]?.value || "overall";
  }
}, { immediate: true });

watch(divisionOptions, (options) => {
  if (!options.some(option => option.value === selectedDivision.value)) {
    selectedDivision.value = "all";
  }
}, { immediate: true });

watch(
  () => [slug.value, selectedDiscipline.value, selectedRoundNumber.value],
  async ([currentSlug]) => {
    if (!currentSlug) {
      return;
    }
    await loadStartingList();
  },
  { immediate: true },
);
</script>

<template>
  <div class="space-y-3">
    <FormHeader
      title="Starting Lists"
      title-tag="h1"
      title-class="text-2xl font-bold"
      wrapper-class="mb-0"
      description="Overview of registered players by discipline and round; shows list position, not final start numbers."
    />

    <PageLoadingState
      v-if="pending"
      wrapper-class="py-12"
    />

    <div
      v-else
      class="card bg-base-200 shadow-sm border border-base-300/60"
    >
      <div class="card-body space-y-3">
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <FormField label="Discipline">
            <select
              v-model="selectedDiscipline"
              class="select select-bordered w-full bg-base-100 text-base-content border-base-300 hover:border-base-content/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              :disabled="loading || busy"
            >
              <option
                v-for="option in disciplineOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
          </FormField>
          <FormField label="Round Number">
            <input
              v-model.number="selectedRoundNumber"
              class="input input-bordered w-full"
              type="number"
              min="1"
              :disabled="loading || busy"
            >
          </FormField>
          <FormField label="Division filter">
            <select
              v-model="selectedDivision"
              class="select select-bordered w-full bg-base-100 text-base-content border-base-300 hover:border-base-content/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              :disabled="loading || busy"
            >
              <option
                v-for="option in divisionOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
          </FormField>
          <FormField label="Group entries">
            <select
              v-model="groupMode"
              class="select select-bordered w-full bg-base-100 text-base-content border-base-300 hover:border-base-content/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              :disabled="loading || busy"
            >
              <option value="division">
                By division
              </option>
              <option value="country">
                By country
              </option>
              <option value="none">
                Flat list
              </option>
            </select>
          </FormField>
        </div>

        <p class="text-xs opacity-70">
          Note: final start numbers with gaps/ranges (for example by country or team) are not assigned on this page yet.
        </p>

        <div class="flex items-start justify-between gap-3 rounded-box border border-base-300/60 p-3">
          <div>
            <h3 class="font-semibold">
              List Status
            </h3>
            <p class="text-xs opacity-70">
              Entries: <strong>{{ state?.entries.length ?? 0 }}</strong>
              · Locked by: <strong>{{ state?.lock.lockedBy || "—" }}</strong>
              · Locked at: <strong>{{ formatTimestamp(state?.lock.lockedAt) }}</strong>
            </p>
          </div>
          <span
            class="badge"
            :class="isLocked ? 'badge-warning' : 'badge-success'"
          >
            {{ isLocked ? 'Locked' : 'Unlocked' }}
          </span>
        </div>

        <div
          v-if="errorMessage"
          class="alert alert-error py-2"
        >
          <span class="text-sm">{{ errorMessage }}</span>
        </div>

        <div
          v-if="successMessage"
          class="alert alert-success py-2"
        >
          <span class="text-sm">{{ successMessage }}</span>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <button
            class="btn btn-sm btn-primary"
            :disabled="loading || busy || isLocked"
            type="button"
            @click="generate(false)"
          >
            Generate
          </button>
          <button
            class="btn btn-sm btn-outline"
            :disabled="loading || busy || isLocked"
            type="button"
            @click="generate(true)"
          >
            Regenerate Overview
          </button>
          <button
            class="btn btn-sm btn-warning"
            :disabled="loading || busy || isLocked"
            type="button"
            @click="setLock(true)"
          >
            Lock List
          </button>
          <button
            class="btn btn-sm btn-outline"
            :disabled="loading || busy || !isLocked"
            type="button"
            @click="setLock(false)"
          >
            Unlock List
          </button>
          <button
            class="btn btn-sm btn-ghost"
            :disabled="loading || busy"
            type="button"
            @click="loadStartingList"
          >
            Refresh
          </button>
        </div>

        <div
          v-if="hasEntries"
          class="rounded-box border border-base-300/50 p-2 space-y-2"
        >
          <div
            v-for="group in groupedEntries"
            :key="group.key"
            class="space-y-2"
          >
            <h4
              v-if="groupMode !== 'none'"
              class="text-sm font-semibold opacity-80 px-1"
            >
              {{ group.label }}
            </h4>

            <div
              v-for="entry in group.entries"
              :key="entry.eventEntryId"
              class="flex items-center justify-between gap-2 rounded-box bg-base-100 px-2 py-1"
            >
              <div class="text-sm">
                <span class="font-semibold">Pos {{ entry.position }}</span>
                <span class="ml-2">{{ entry.playerName || entry.eventEntryId }}</span>
                <span class="ml-2 opacity-70">({{ entry.activeCompetitiveDivisionSnapshot }})</span>
                <span class="ml-2 opacity-70">{{ entry.userCountry || "—" }}</span>
              </div>
            </div>
          </div>
        </div>

        <p
          v-else
          class="text-sm opacity-70"
        >
          No entries found for the selected discipline/round/division.
        </p>
      </div>
    </div>
  </div>
</template>
