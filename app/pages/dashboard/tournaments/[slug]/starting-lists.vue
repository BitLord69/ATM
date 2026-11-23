<script setup lang="ts">
import type { PoolAssignmentMode } from "#shared/schemas/starting-lists";
import type { VerticalTabConfig } from "~/components/vertical-tabs-layout.vue";
import type { TournamentEditResponse } from "~/types/tournaments";

type StartingListLockState = {
  isLocked: boolean;
  lockedBy: string | null;
  lockedAt: number | null;
};

type StartingListGolfSettings = {
  rounds: number | null;
  cumulativeRounds: number | null;
  poolMode: "static" | "dynamic";
  poolCount: number;
  poolLabels: string[];
  golfStartEnabled: boolean;
  roundPar: number | null;
  roundLayout: {
    venueId?: number | null;
    venueName?: string | null;
    layoutId?: string | null;
    layoutName?: string | null;
  } | null;
};

type StartingListEntryView = {
  id: string;
  eventEntryId: string;
  discipline: string;
  roundNumber: number;
  position: number;
  poolName: string | null;
  activeCompetitiveDivisionSnapshot: string;
  playerName: string | null;
  userCountry?: string | null;
  playerNumber?: number | null;
  minorDivisionTags?: string[];
};

type StartingListResponse = {
  tournamentId: number;
  discipline: string;
  roundNumber: number;
  canManage: boolean;
  golfSettings: StartingListGolfSettings;
  lock: StartingListLockState;
  entries: StartingListEntryView[];
};

definePageMeta({ ssr: false, layout: "tournament-admin" });

const route = useRoute();
const slug = computed(() => route.params.slug as string);

const { data, pending, error } = await useFetch<TournamentEditResponse>(() => `/api/tournaments/${slug.value}/edit`);

if (error.value) {
  throw createError({
    statusCode: error.value.statusCode || 404,
    message: error.value.message || "Tournament not found",
  });
}

const activeTab = ref("controls");
const startingListTabs: VerticalTabConfig[] = [
  { id: "controls", label: "Round & pool setup" },
  { id: "entries", label: "Pools & starting order" },
];

const disciplineOptions = computed(() => {
  const tournament = data.value;
  if (!tournament || Array.isArray(tournament)) {
    return [{ value: "overall", label: "Overall" }];
  }

  const options: Array<{ value: string; label: string }> = [];

  if (tournament.hasGolf) {
    options.push({ value: "golf", label: "Disc golf" });
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

  options.push({ value: "overall", label: "Overall" });
  return options;
});

const assignmentModeOptions = [
  { value: "manual", label: "Manual (unassigned)", sublabel: "Leave unassigned so you can match Tjing / UDisc pools with 1-click buttons" },
  { value: "division", label: "By division", sublabel: "Distribute players evenly across pools grouped by division" },
  { value: "random", label: "Random", sublabel: "Shuffle and split players evenly across pools" },
];

const selectedDiscipline = ref("golf");
const selectedRoundNumber = ref(1);
const assignmentMode = ref<PoolAssignmentMode>("manual");
const cutSizeInput = ref("");

const state = ref<StartingListResponse | null>(null);
const loading = ref(false);
const busy = ref(false);
const updatingEntryId = ref<string | null>(null);
const errorMessage = ref<string | null>(null);
const successMessage = ref<string | null>(null);

const selectedDivision = ref("all");
const selectedPoolFilter = ref("all");
const groupMode = ref<"pool" | "division" | "country" | "none">("pool");

const isGolf = computed(() => selectedDiscipline.value === "golf");
const golfSettings = computed(() => state.value?.golfSettings ?? null);
const poolLabels = computed(() => golfSettings.value?.poolLabels ?? ["Pool A"]);
const isMultiPoolGolf = computed(() => isGolf.value && poolLabels.value.length > 1);
const canManage = computed(() => !!state.value?.canManage);
const hasEntries = computed(() => (state.value?.entries.length ?? 0) > 0);
const isLocked = computed(() => !!state.value?.lock?.isLocked);
const showOrderControls = computed(() => canManage.value && !isLocked.value && (!isGolf.value || !!golfSettings.value?.golfStartEnabled));

const configuredRoundsCount = computed(() => {
  if (!isGolf.value) {
    return 0;
  }
  const rounds = golfSettings.value?.rounds ?? 0;
  return rounds > 0 ? Math.min(rounds, 50) : 0;
});

const roundOptions = computed(() =>
  Array.from({ length: configuredRoundsCount.value }, (_, idx) => ({
    value: String(idx + 1),
    label: `Round ${idx + 1}`,
  })),
);

const isCutRound = computed(() => {
  if (!isGolf.value || !golfSettings.value?.cumulativeRounds) {
    return false;
  }
  return selectedRoundNumber.value > golfSettings.value.cumulativeRounds;
});

const groupModeOptions = computed(() => {
  const options: Array<{ value: string; label: string }> = [];
  if (isGolf.value) {
    options.push({ value: "pool", label: "Group by pool" });
  }
  options.push(
    { value: "division", label: "Group by division" },
    { value: "country", label: "Group by country" },
    { value: "none", label: "Flat list" },
  );
  return options;
});

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

function shortPoolCode(poolLabel: string) {
  return poolLabel.replace(/^Pool\s+/i, "");
}

const orderedEntries = computed(() => {
  const entries = state.value?.entries ?? [];
  return [...entries].sort((left, right) => left.position - right.position);
});

const poolCounts = computed(() => {
  const counts = new Map<string, number>();
  for (const label of poolLabels.value) {
    counts.set(label, 0);
  }
  let unassigned = 0;

  for (const entry of orderedEntries.value) {
    if (!entry.poolName) {
      unassigned += 1;
    }
    else {
      counts.set(entry.poolName, (counts.get(entry.poolName) ?? 0) + 1);
    }
  }

  return { counts, unassigned };
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
  return orderedEntries.value.filter((entry) => {
    if (selectedDivision.value !== "all" && entry.activeCompetitiveDivisionSnapshot !== selectedDivision.value) {
      return false;
    }
    if (isMultiPoolGolf.value && selectedPoolFilter.value !== "all") {
      if (selectedPoolFilter.value === "unassigned") {
        return !entry.poolName;
      }
      return entry.poolName === selectedPoolFilter.value;
    }
    return true;
  });
});

const groupedEntries = computed(() => {
  if (groupMode.value === "none") {
    return [
      {
        key: "all",
        label: "All visible players",
        entries: visibleEntries.value,
      },
    ];
  }

  if (groupMode.value === "pool" && isGolf.value) {
    const groups: Array<{ key: string; label: string; entries: StartingListEntryView[] }> = [];
    const unassignedEntries = visibleEntries.value.filter(entry => !entry.poolName);
    if (unassignedEntries.length > 0) {
      groups.push({
        key: "__unassigned__",
        label: "Unassigned",
        entries: unassignedEntries,
      });
    }

    for (const poolLabel of poolLabels.value) {
      const matching = visibleEntries.value.filter(entry => entry.poolName === poolLabel);
      if (matching.length > 0) {
        groups.push({
          key: poolLabel,
          label: poolLabel,
          entries: matching,
        });
      }
    }

    // Include any unexpected legacy pool names if present
    const known = new Set(poolLabels.value);
    const otherEntries = visibleEntries.value.filter(entry => entry.poolName && !known.has(entry.poolName));
    if (otherEntries.length > 0) {
      groups.push({
        key: "__other__",
        label: "Other pools",
        entries: otherEntries,
      });
    }

    return groups;
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

  const parsedCut = cutSizeInput.value.trim() ? Number(cutSizeInput.value.trim()) : null;
  const cutSize = parsedCut && Number.isInteger(parsedCut) && parsedCut > 0 ? parsedCut : null;

  try {
    await $fetch(`/api/tournaments/${slug.value}/starting-lists/generate`, {
      method: "POST",
      body: {
        discipline: selectedDiscipline.value,
        roundNumber: selectedRoundNumber.value,
        overwrite,
        assignmentMode: assignmentMode.value,
        cutSize,
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

async function assignEntryPool(entry: StartingListEntryView, targetPool: string | null) {
  if (!canManage.value || isLocked.value || updatingEntryId.value) {
    return;
  }
  if (entry.poolName === targetPool) {
    return;
  }

  const previousPool = entry.poolName;
  entry.poolName = targetPool;
  updatingEntryId.value = entry.eventEntryId;
  errorMessage.value = null;

  try {
    await $fetch(`/api/tournaments/${slug.value}/starting-lists/pools`, {
      method: "PATCH",
      body: {
        discipline: selectedDiscipline.value,
        roundNumber: selectedRoundNumber.value,
        assignments: [
          {
            eventEntryId: entry.eventEntryId,
            poolName: targetPool,
          },
        ],
      },
    });
  }
  catch (fetchError: any) {
    entry.poolName = previousPool;
    errorMessage.value = getApiErrorMessage(fetchError, "Failed to update pool assignment.");
  }
  finally {
    updatingEntryId.value = null;
  }
}

async function moveEntryOrder(entry: StartingListEntryView, direction: -1 | 1) {
  if (!showOrderControls.value || busy.value || updatingEntryId.value || !state.value) {
    return;
  }

  const allOrdered = [...orderedEntries.value];
  const currentIndex = allOrdered.findIndex(item => item.eventEntryId === entry.eventEntryId);
  if (currentIndex < 0) {
    return;
  }

  // Find adjacent entry within same pool (for golf) or overall list
  let swapIndex = -1;
  for (let i = currentIndex + direction; i >= 0 && i < allOrdered.length; i += direction) {
    if (!isMultiPoolGolf.value || allOrdered[i]?.poolName === entry.poolName) {
      swapIndex = i;
      break;
    }
  }

  if (swapIndex < 0) {
    return;
  }

  const temp = allOrdered[currentIndex]!;
  allOrdered[currentIndex] = allOrdered[swapIndex]!;
  allOrdered[swapIndex] = temp;

  const orderedEventEntryIds = allOrdered.map(item => item.eventEntryId);
  updatingEntryId.value = entry.eventEntryId;
  errorMessage.value = null;

  try {
    await $fetch(`/api/tournaments/${slug.value}/starting-lists/reorder`, {
      method: "PATCH",
      body: {
        discipline: selectedDiscipline.value,
        roundNumber: selectedRoundNumber.value,
        orderedEventEntryIds,
      },
    });
    await loadStartingList();
  }
  catch (fetchError: any) {
    errorMessage.value = getApiErrorMessage(fetchError, "Failed to update starting order.");
  }
  finally {
    updatingEntryId.value = null;
  }
}

watch(disciplineOptions, (options) => {
  if (!options.some(option => option.value === selectedDiscipline.value)) {
    selectedDiscipline.value = options[0]?.value || "overall";
  }
}, { immediate: true });

watch(isGolf, (golfSelected) => {
  if (golfSelected) {
    groupMode.value = "pool";
  }
  else if (groupMode.value === "pool") {
    groupMode.value = "division";
  }
  selectedPoolFilter.value = "all";
});

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
    selectedPoolFilter.value = "all";
    await loadStartingList();
  },
  { immediate: true },
);
</script>

<template>
  <div class="space-y-4">
    <FormHeader
      title="Starting lists"
      title-tag="h1"
      title-class="text-2xl font-bold"
      wrapper-class="mb-0"
      description="Manage round starting lists and disc golf pool assignments."
    />

    <FlashAlert
      :message="errorMessage"
      type="error"
      role="alert"
      :auto-hide-ms="0"
      @dismiss="errorMessage = null"
    />

    <FlashAlert
      :message="successMessage"
      type="success"
      role="status"
      @dismiss="successMessage = null"
    />

    <PageLoadingState
      v-if="pending"
      wrapper-class="py-12"
    />

    <VerticalTabsLayout
      v-else
      v-model="activeTab"
      :tabs="startingListTabs"
      :initial-open-tab-ids="['controls', 'entries']"
      :session-state-key="`starting-lists:${slug}`"
    >
      <template #controls>
        <div class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <FormField label="Discipline">
              <SearchableSelect
                :model-value="selectedDiscipline"
                :options="disciplineOptions"
                :disabled="loading || busy"
                placeholder="Select discipline..."
                @update:model-value="selectedDiscipline = $event || 'overall'"
              />
            </FormField>

            <FormField label="Round">
              <SearchableSelect
                v-if="configuredRoundsCount > 0"
                :model-value="String(selectedRoundNumber)"
                :options="roundOptions"
                :disabled="loading || busy"
                placeholder="Select round..."
                @update:model-value="selectedRoundNumber = Math.max(1, Number($event) || 1)"
              />
              <input
                v-else
                v-model.number="selectedRoundNumber"
                class="input input-bordered w-full"
                type="number"
                min="1"
                max="50"
                :disabled="loading || busy"
              >
            </FormField>

            <FormField
              v-if="isMultiPoolGolf && selectedRoundNumber === 1"
              label="Round 1 pool assignment"
            >
              <SearchableSelect
                :model-value="assignmentMode"
                :options="assignmentModeOptions"
                :disabled="loading || busy"
                placeholder="Select assignment mode..."
                @update:model-value="assignmentMode = ($event === 'division' || $event === 'random' ? $event : 'manual')"
              />
            </FormField>

            <FormField
              v-if="isGolf && selectedRoundNumber > 1 && isCutRound"
              label="Cut size (optional)"
              hint="Keep only top N players for this round."
            >
              <input
                v-model="cutSizeInput"
                class="input input-bordered w-full"
                type="number"
                min="1"
                max="500"
                placeholder="All players"
                :disabled="loading || busy"
              >
            </FormField>
          </div>

          <!-- Disc golf round context banner -->
          <div
            v-if="isGolf && golfSettings"
            class="rounded-box bg-base-200/70 border border-base-300/60 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs"
          >
            <div class="flex flex-wrap items-center gap-2">
              <span class="badge badge-sm badge-outline">
                {{ golfSettings.poolCount === 1 ? "1 pool" : `${golfSettings.poolCount} pools (${poolLabels.join(", ")})` }}
              </span>
              <span class="badge badge-sm badge-outline">
                {{ golfSettings.poolMode === "dynamic" ? "Dynamic sorting" : "Static pools" }}
              </span>
              <span class="badge badge-sm badge-outline">
                {{ golfSettings.golfStartEnabled ? "Golf start enabled" : "External app hole start" }}
              </span>
              <span
                v-if="golfSettings.roundLayout?.venueName || golfSettings.roundPar"
                class="opacity-80"
              >
                Round {{ selectedRoundNumber }}:
                <strong v-if="golfSettings.roundLayout?.venueName">{{ golfSettings.roundLayout.venueName }}</strong>
                <span v-if="golfSettings.roundLayout?.layoutName"> · {{ golfSettings.roundLayout.layoutName }}</span>
                <span v-if="golfSettings.roundPar"> · Par {{ golfSettings.roundPar }}</span>
              </span>
            </div>

            <span class="opacity-70">
              <template v-if="selectedRoundNumber > 1 && golfSettings.poolMode === 'static'">
                Round {{ selectedRoundNumber }} inherits pools from round {{ selectedRoundNumber - 1 }}.
              </template>
              <template v-else-if="selectedRoundNumber > 1 && golfSettings.poolMode === 'dynamic'">
                Dynamic mode splits tiers across pools (sorted by standings once scores are entered).
              </template>
              <template v-else-if="!golfSettings.golfStartEnabled">
                External scoring app (Tjing/UDisc etc) handles starting holes and groups; ATM tracks pool membership.
              </template>
            </span>
          </div>

          <!-- Lock status & actions -->
          <div class="rounded-box bg-base-200/50 border border-base-300/60 p-3 flex flex-wrap items-center justify-between gap-3">
            <div class="space-y-0.5">
              <div class="flex items-center gap-2 text-sm font-medium">
                <span>List status</span>
                <span
                  class="badge badge-sm"
                  :class="isLocked ? 'badge-warning' : 'badge-success'"
                >
                  {{ isLocked ? "Locked" : "Unlocked" }}
                </span>
                <span class="text-xs opacity-70">
                  ({{ orderedEntries.length }} {{ orderedEntries.length === 1 ? "player" : "players" }})
                </span>
              </div>
              <p class="text-xs opacity-70">
                Locked by: <strong>{{ state?.lock?.lockedBy || "—" }}</strong>
                · Locked at: <strong>{{ formatTimestamp(state?.lock?.lockedAt) }}</strong>
              </p>
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <button
                v-if="canManage && !hasEntries"
                class="btn btn-sm btn-primary"
                type="button"
                :disabled="loading || busy || isLocked"
                @click="generate(false)"
              >
                <span
                  v-if="busy"
                  class="loading loading-spinner loading-xs"
                />
                <span v-else>Generate starting list</span>
              </button>
              <button
                v-if="canManage && hasEntries"
                class="btn btn-sm btn-secondary"
                type="button"
                :disabled="loading || busy || isLocked"
                @click="generate(true)"
              >
                <span
                  v-if="busy"
                  class="loading loading-spinner loading-xs"
                />
                <span v-else>Regenerate list</span>
              </button>
              <button
                v-if="canManage"
                class="btn btn-sm btn-warning"
                type="button"
                :disabled="loading || busy || isLocked"
                @click="setLock(true)"
              >
                Lock list
              </button>
              <button
                v-if="canManage"
                class="btn btn-sm btn-outline"
                type="button"
                :disabled="loading || busy || !isLocked"
                @click="setLock(false)"
              >
                Unlock list
              </button>
              <button
                class="btn btn-sm btn-ghost"
                type="button"
                :disabled="loading || busy"
                @click="loadStartingList"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>
      </template>

      <template #entries>
        <div class="space-y-4">
          <PageLoadingState
            v-if="loading"
            wrapper-class="py-8"
          />

          <EmptyStateAlert
            v-else-if="!hasEntries"
            message="No starting list has been generated for this discipline and round yet. Use Generate starting list above."
          />

          <template v-else>
            <!-- Pool quick filter pills (multi-pool disc golf) -->
            <div
              v-if="isMultiPoolGolf"
              class="flex flex-wrap items-center gap-1.5"
            >
              <button
                type="button"
                class="btn btn-xs"
                :class="selectedPoolFilter === 'all' ? 'btn-primary' : 'btn-ghost border border-base-300'"
                @click="selectedPoolFilter = 'all'"
              >
                All ({{ orderedEntries.length }})
              </button>
              <button
                v-if="poolCounts.unassigned > 0"
                type="button"
                class="btn btn-xs"
                :class="selectedPoolFilter === 'unassigned' ? 'btn-warning' : 'btn-outline btn-warning'"
                @click="selectedPoolFilter = 'unassigned'"
              >
                Unassigned ({{ poolCounts.unassigned }})
              </button>
              <button
                v-for="poolLabel in poolLabels"
                :key="poolLabel"
                type="button"
                class="btn btn-xs"
                :class="selectedPoolFilter === poolLabel ? 'btn-secondary' : 'btn-ghost border border-base-300'"
                @click="selectedPoolFilter = poolLabel"
              >
                {{ poolLabel }} ({{ poolCounts.counts.get(poolLabel) ?? 0 }})
              </button>
            </div>

            <!-- Filter & grouping bar -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Division filter">
                <SearchableSelect
                  :model-value="selectedDivision"
                  :options="divisionOptions"
                  size="sm"
                  placeholder="All divisions"
                  @update:model-value="selectedDivision = $event || 'all'"
                />
              </FormField>

              <FormField label="Grouping">
                <SearchableSelect
                  :model-value="groupMode"
                  :options="groupModeOptions"
                  size="sm"
                  placeholder="Select grouping..."
                  @update:model-value="groupMode = ($event as any) || 'division'"
                />
              </FormField>
            </div>

            <EmptyStateAlert
              v-if="visibleEntries.length === 0"
              message="No players match the current filter."
            />

            <div
              v-else
              class="space-y-4"
            >
              <div
                v-for="group in groupedEntries"
                :key="group.key"
                class="rounded-box bg-base-200/40 border border-base-300/60 overflow-hidden"
              >
                <div class="px-3.5 py-2 bg-base-200/80 border-b border-base-300/60 flex items-center justify-between gap-2">
                  <h3 class="text-sm font-semibold">
                    {{ group.label }}
                  </h3>
                  <span class="badge badge-sm badge-ghost">
                    {{ group.entries.length }} {{ group.entries.length === 1 ? "player" : "players" }}
                  </span>
                </div>

                <div class="overflow-x-auto">
                  <table class="table table-sm">
                    <thead>
                      <tr>
                        <th class="w-16">
                          {{ isGolf && golfSettings?.golfStartEnabled ? "Start #" : "Pos" }}
                        </th>
                        <th>Player</th>
                        <th>#</th>
                        <th>Country</th>
                        <th>Division</th>
                        <th v-if="isGolf">
                          Pool
                        </th>
                        <th
                          v-if="showOrderControls"
                          class="text-right w-24"
                        >
                          Order
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="(entry, rowIdx) in group.entries"
                        :key="entry.id"
                      >
                        <td class="font-mono text-xs opacity-75">
                          {{ isGolf && golfSettings?.golfStartEnabled ? rowIdx + 1 : entry.position }}
                        </td>
                        <td class="font-medium">
                          {{ entry.playerName || entry.eventEntryId }}
                        </td>
                        <td class="font-mono text-xs opacity-75">
                          {{ entry.playerNumber ?? "—" }}
                        </td>
                        <td class="text-xs opacity-80">
                          {{ entry.userCountry || "—" }}
                        </td>
                        <td>
                          <span class="badge badge-sm badge-outline">
                            {{ entry.activeCompetitiveDivisionSnapshot }}
                          </span>
                        </td>
                        <td v-if="isGolf">
                          <div
                            v-if="isMultiPoolGolf && canManage && !isLocked"
                            class="flex flex-wrap items-center gap-1"
                          >
                            <button
                              v-for="poolLabel in poolLabels"
                              :key="poolLabel"
                              type="button"
                              class="btn btn-xs min-w-7 px-2"
                              :class="entry.poolName === poolLabel ? 'btn-primary' : 'btn-ghost border border-base-300'"
                              :disabled="updatingEntryId === entry.eventEntryId"
                              :title="`Assign to ${poolLabel}`"
                              @click="assignEntryPool(entry, poolLabel)"
                            >
                              {{ shortPoolCode(poolLabel) }}
                            </button>
                            <button
                              v-if="entry.poolName"
                              type="button"
                              class="btn btn-xs btn-ghost px-1.5 opacity-60 hover:opacity-100"
                              :disabled="updatingEntryId === entry.eventEntryId"
                              title="Clear pool assignment"
                              @click="assignEntryPool(entry, null)"
                            >
                              ×
                            </button>
                          </div>
                          <span
                            v-else
                            class="badge badge-sm"
                            :class="entry.poolName ? 'badge-secondary' : 'badge-warning badge-outline'"
                          >
                            {{ entry.poolName || "Unassigned" }}
                          </span>
                        </td>
                        <td
                          v-if="showOrderControls"
                          class="text-right"
                        >
                          <div class="inline-flex items-center gap-1">
                            <button
                              type="button"
                              class="btn btn-xs btn-ghost btn-square"
                              :disabled="rowIdx === 0 || updatingEntryId === entry.eventEntryId"
                              aria-label="Move up"
                              @click="moveEntryOrder(entry, -1)"
                            >
                              <Icon
                                name="tabler:arrow-up"
                                size="14"
                              />
                            </button>
                            <button
                              type="button"
                              class="btn btn-xs btn-ghost btn-square"
                              :disabled="rowIdx === group.entries.length - 1 || updatingEntryId === entry.eventEntryId"
                              aria-label="Move down"
                              @click="moveEntryOrder(entry, 1)"
                            >
                              <Icon
                                name="tabler:arrow-down"
                                size="14"
                              />
                            </button>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </template>
        </div>
      </template>
    </VerticalTabsLayout>
  </div>
</template>
