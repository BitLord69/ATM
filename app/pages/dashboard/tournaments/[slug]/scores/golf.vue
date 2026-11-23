<script setup lang="ts">
import type { RoundScoreStatus } from "#shared/schemas/golf-scores";
import type { VerticalTabConfig } from "~/components/vertical-tabs-layout.vue";

type GolfScorePlayerRow = {
  eventEntryId: string;
  playerId: string;
  playerName: string;
  country: string | null;
  playerNumber: number | null;
  majorDivision: string;
  minorDivisionTags: string[];
  playoffRank: number | null;
  poolName: string | null;
  startPosition: number | null;
  strokes: number | null;
  status: RoundScoreStatus;
};

type GolfStandingRoundCell = {
  roundNumber: number;
  strokes: number | null;
  status: RoundScoreStatus;
  par: number | null;
  relativeToPar: number | null;
};

type GolfStandingRow = {
  eventEntryId: string;
  playerId: string;
  playerName: string;
  country: string | null;
  playerNumber: number | null;
  majorDivision: string;
  minorDivisionTags: string[];
  playoffRank: number | null;
  rounds: GolfStandingRoundCell[];
  completedRounds: number;
  totalStrokes: number | null;
  relativeToPar: number | null;
  overallStatus: RoundScoreStatus | "pending";
  rank: number | null;
  isTied: boolean;
  resolvedByPlayoff: boolean;
};

type GolfPodiumTieGroup = {
  division: string;
  baseRank: number;
  totalStrokes: number;
  players: Array<{
    eventEntryId: string;
    playerName: string;
    playoffRank: number | null;
  }>;
};

type GolfScoresResponse = {
  tournamentId: number;
  roundNumber: number;
  canManage: boolean;
  startingListStatus: {
    hasStartingList: boolean;
    isLocked: boolean;
    canEnterScores: boolean;
  };
  golfSettings: {
    rounds: number;
    cumulativeRounds: number | null;
    poolMode: "static" | "dynamic";
    poolCount: number;
    poolLabels: string[];
    golfStartEnabled: boolean;
    roundPars: Array<number | null>;
    roundPar: number | null;
    roundLayout: {
      venueId?: number | null;
      venueName?: string | null;
      layoutId?: string | null;
      layoutName?: string | null;
    } | null;
  };
  players: GolfScorePlayerRow[];
  standings: GolfStandingRow[];
  podiumTies: GolfPodiumTieGroup[];
};

type DraftRow = {
  strokes: string | number;
  status: RoundScoreStatus;
};

function normalizeDraftString(value: string | number | null | undefined) {
  return String(value ?? "").trim();
}

definePageMeta({ ssr: false, layout: "tournament-admin" });

const route = useRoute();
const slug = computed(() => route.params.slug as string);

const activeTab = ref("entry");
const scoreTabs: VerticalTabConfig[] = [
  { id: "controls", label: "Round & filters" },
  { id: "entry", label: "Score entry" },
  { id: "standings", label: "Standings & playoffs" },
];

const selectedRoundNumber = ref(1);
const selectedPoolFilter = ref("all");
const selectedDivisionFilter = ref("all");
const searchQuery = ref("");
const standingsDivisionFilter = ref("all");

const state = ref<GolfScoresResponse | null>(null);
const loading = ref(false);
const saving = ref(false);
const savingPlayoffs = ref(false);
const errorMessage = ref<string | null>(null);
const successMessage = ref<string | null>(null);

const drafts = reactive<Record<string, DraftRow>>({});
const playoffDrafts = reactive<Record<string, string | number>>({});

const canManage = computed(() => !!state.value?.canManage);
const startingListStatus = computed(() => state.value?.startingListStatus ?? {
  hasStartingList: false,
  isLocked: false,
  canEnterScores: false,
});
const canEditRoundScores = computed(() => startingListStatus.value.canEnterScores);
const golfSettings = computed(() => state.value?.golfSettings ?? null);
const currentRoundPar = computed(() => golfSettings.value?.roundPar ?? null);

const roundOptions = computed(() => {
  const count = Math.max(1, golfSettings.value?.rounds ?? 1);
  return Array.from({ length: count }, (_, idx) => ({
    value: String(idx + 1),
    label: `Round ${idx + 1}`,
  }));
});

const poolFilterOptions = computed(() => {
  const labels = golfSettings.value?.poolLabels ?? [];
  const options = [{ value: "all", label: "All pools" }];
  for (const label of labels) {
    options.push({ value: label, label });
  }
  const hasUnassigned = (state.value?.players ?? []).some(p => !p.poolName);
  if (hasUnassigned && labels.length > 1) {
    options.push({ value: "unassigned", label: "Unassigned" });
  }
  return options;
});

const divisionFilterOptions = computed(() => {
  const divisions = new Set((state.value?.players ?? []).map(p => p.majorDivision));
  return [
    { value: "all", label: "All divisions" },
    ...[...divisions].sort((a, b) => a.localeCompare(b)).map(d => ({ value: d, label: d })),
  ];
});

const visiblePlayers = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  return (state.value?.players ?? []).filter((p) => {
    if (selectedDivisionFilter.value !== "all" && p.majorDivision !== selectedDivisionFilter.value) {
      return false;
    }
    if (selectedPoolFilter.value !== "all") {
      if (selectedPoolFilter.value === "unassigned" && p.poolName) {
        return false;
      }
      if (selectedPoolFilter.value !== "unassigned" && p.poolName !== selectedPoolFilter.value) {
        return false;
      }
    }
    if (q) {
      return p.playerName.toLowerCase().includes(q)
        || (p.country || "").toLowerCase().includes(q)
        || String(p.playerNumber ?? "").includes(q);
    }
    return true;
  });
});

const scoredPlayerCount = computed(() => {
  let count = 0;
  for (const p of state.value?.players ?? []) {
    const d = drafts[p.eventEntryId];
    if (d && (d.status !== "ok" || normalizeDraftString(d.strokes) !== "")) {
      count += 1;
    }
  }
  return count;
});

const standingsByDivision = computed(() => {
  const map = new Map<string, GolfStandingRow[]>();
  for (const row of state.value?.standings ?? []) {
    if (standingsDivisionFilter.value !== "all" && row.majorDivision !== standingsDivisionFilter.value) {
      continue;
    }
    const list = map.get(row.majorDivision) ?? [];
    list.push(row);
    map.set(row.majorDivision, list);
  }
  return [...map.entries()].map(([division, rows]) => ({ division, rows }));
});

function createDraftSnapshot() {
  const sortedKeys = Object.keys(drafts).sort();
  return JSON.stringify(
    sortedKeys.map(key => [key, normalizeDraftString(drafts[key]?.strokes), drafts[key]?.status ?? "ok"]),
  );
}

const {
  hasUnsavedChanges,
  captureInitialSnapshot,
} = useSnapshotDirtyState(createDraftSnapshot);

const {
  showLeaveConfirmModal,
  modalTitle,
  modalMessage,
  modalConfirmText,
  modalCancelText,
  confirmLeavePage,
  cancelLeavePage,
} = useUnsavedChangesGuard(hasUnsavedChanges);

function syncDraftsFromState(data: GolfScoresResponse) {
  for (const key of Object.keys(drafts)) {
    delete drafts[key];
  }
  for (const key of Object.keys(playoffDrafts)) {
    delete playoffDrafts[key];
  }

  for (const p of data.players) {
    drafts[p.eventEntryId] = {
      strokes: p.strokes != null ? String(p.strokes) : "",
      status: p.status,
    };
    playoffDrafts[p.eventEntryId] = p.playoffRank != null ? String(p.playoffRank) : "";
  }

  captureInitialSnapshot();
}

function formatRelativeToPar(diff: number | null) {
  if (diff == null) {
    return "—";
  }
  if (diff === 0) {
    return "E";
  }
  return diff > 0 ? `+${diff}` : String(diff);
}

function relativeToParClass(diff: number | null) {
  if (diff == null) {
    return "opacity-50";
  }
  if (diff < 0) {
    return "text-success font-semibold";
  }
  if (diff > 0) {
    return "text-error";
  }
  return "opacity-80 font-medium";
}

function getDraftRelativeToPar(eventEntryId: string): number | null {
  if (currentRoundPar.value == null) {
    return null;
  }
  const d = drafts[eventEntryId];
  if (!d || d.status !== "ok") {
    return null;
  }
  const raw = normalizeDraftString(d.strokes);
  const parsed = Number(raw);
  if (!raw || !Number.isInteger(parsed)) {
    return null;
  }
  return parsed - currentRoundPar.value;
}

function setRowStatus(eventEntryId: string, status: RoundScoreStatus) {
  const row = drafts[eventEntryId];
  if (!row) {
    return;
  }
  row.status = status;
  if (status !== "ok") {
    row.strokes = "";
  }
}

function onStrokesInput(eventEntryId: string) {
  const row = drafts[eventEntryId];
  if (!row) {
    return;
  }
  if (normalizeDraftString(row.strokes) !== "" && row.status !== "ok") {
    row.status = "ok";
  }
}

function focusNextScoreInput(currentIndex: number) {
  const nextPlayer = visiblePlayers.value[currentIndex + 1];
  if (!nextPlayer) {
    return;
  }
  const el = document.getElementById(`golf-score-${nextPlayer.eventEntryId}`);
  if (el instanceof HTMLInputElement) {
    el.focus();
    el.select();
  }
}

async function loadScores() {
  loading.value = true;
  errorMessage.value = null;
  try {
    const response = await $fetch<GolfScoresResponse>(`/api/tournaments/${slug.value}/scores/golf`, {
      query: { roundNumber: selectedRoundNumber.value },
    });
    state.value = response;
    syncDraftsFromState(response);
  }
  catch (err: any) {
    errorMessage.value = getApiErrorMessage(err, "Failed to load disc golf scores.");
  }
  finally {
    loading.value = false;
  }
}

async function saveScores() {
  if (!state.value || saving.value) {
    return;
  }

  errorMessage.value = null;
  successMessage.value = null;

  const changedScores: Array<{ eventEntryId: string; strokes: number | null; status: RoundScoreStatus }> = [];

  for (const p of state.value.players) {
    const d = drafts[p.eventEntryId];
    if (!d) {
      continue;
    }

    let parsedStrokes: number | null = null;
    const rawStrokes = normalizeDraftString(d.strokes);
    if (d.status === "ok" && rawStrokes !== "") {
      const n = Number(rawStrokes);
      if (!Number.isInteger(n) || n < 10 || n > 300) {
        errorMessage.value = `Invalid strokes for ${p.playerName} (must be an integer between 10 and 300).`;
        return;
      }
      parsedStrokes = n;
    }

    const origStrokes = p.strokes ?? null;
    const origStatus = p.status;
    if (parsedStrokes !== origStrokes || d.status !== origStatus) {
      changedScores.push({
        eventEntryId: p.eventEntryId,
        strokes: parsedStrokes,
        status: d.status,
      });
    }
  }

  if (changedScores.length === 0) {
    return;
  }

  saving.value = true;
  try {
    await $fetch(`/api/tournaments/${slug.value}/scores/golf`, {
      method: "PUT",
      body: {
        roundNumber: selectedRoundNumber.value,
        scores: changedScores,
      },
    });
    successMessage.value = `Saved ${changedScores.length} round ${selectedRoundNumber.value} ${changedScores.length === 1 ? "score" : "scores"}.`;
    await loadScores();
  }
  catch (err: any) {
    errorMessage.value = getApiErrorMessage(err, "Failed to save scores.");
  }
  finally {
    saving.value = false;
  }
}

async function savePlayoffs() {
  if (!state.value || savingPlayoffs.value) {
    return;
  }

  errorMessage.value = null;
  successMessage.value = null;

  const playoffItems: Array<{ eventEntryId: string; playoffRank: number | null }> = [];
  for (const group of state.value.podiumTies) {
    for (const p of group.players) {
      const raw = normalizeDraftString(playoffDrafts[p.eventEntryId]);
      const parsed = raw ? Number(raw) : null;
      if (parsed != null && (!Number.isInteger(parsed) || parsed < 1 || parsed > 10)) {
        errorMessage.value = `Invalid playoff rank for ${p.playerName}.`;
        return;
      }
      playoffItems.push({
        eventEntryId: p.eventEntryId,
        playoffRank: parsed,
      });
    }
  }

  savingPlayoffs.value = true;
  try {
    await $fetch(`/api/tournaments/${slug.value}/scores/golf`, {
      method: "PUT",
      body: {
        roundNumber: selectedRoundNumber.value,
        scores: [],
        playoffs: playoffItems,
      },
    });
    successMessage.value = "Playoff tie-breaker order saved.";
    await loadScores();
  }
  catch (err: any) {
    errorMessage.value = getApiErrorMessage(err, "Failed to save playoff tie-breaker.");
  }
  finally {
    savingPlayoffs.value = false;
  }
}

watch(
  () => [slug.value, selectedRoundNumber.value],
  async ([currentSlug]) => {
    if (!currentSlug) {
      return;
    }
    selectedPoolFilter.value = "all";
    await loadScores();
  },
  { immediate: true },
);
</script>

<template>
  <div class="space-y-4">
    <FormHeader
      title="Disc golf score entry"
      title-tag="h1"
      title-class="text-2xl font-bold"
      wrapper-class="mb-0"
      description="Enter total strokes per round (scores appear immediately on standings once saved)."
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

    <VerticalTabsLayout
      v-model="activeTab"
      :tabs="scoreTabs"
      :initial-open-tab-ids="['controls', 'entry', 'standings']"
      :session-state-key="`golf-scores:${slug}`"
    >
      <template #controls>
        <div class="space-y-3">
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <FormField label="Round">
              <SearchableSelect
                :model-value="String(selectedRoundNumber)"
                :options="roundOptions"
                :disabled="loading || saving"
                placeholder="Select round..."
                @update:model-value="selectedRoundNumber = Math.max(1, Number($event) || 1)"
              />
            </FormField>

            <FormField label="Pool filter">
              <SearchableSelect
                :model-value="selectedPoolFilter"
                :options="poolFilterOptions"
                :disabled="loading"
                placeholder="All pools"
                @update:model-value="selectedPoolFilter = $event || 'all'"
              />
            </FormField>

            <FormField label="Division filter">
              <SearchableSelect
                :model-value="selectedDivisionFilter"
                :options="divisionFilterOptions"
                :disabled="loading"
                placeholder="All divisions"
                @update:model-value="selectedDivisionFilter = $event || 'all'"
              />
            </FormField>

            <FormField label="Search player">
              <input
                v-model="searchQuery"
                type="search"
                class="input input-bordered w-full"
                placeholder="Name, country or #..."
              >
            </FormField>
          </div>

          <div
            v-if="golfSettings"
            class="rounded-box bg-base-200/70 border border-base-300/60 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs"
          >
            <div class="flex flex-wrap items-center gap-2">
              <span class="badge badge-sm badge-primary">
                Round {{ selectedRoundNumber }} of {{ golfSettings.rounds }}
              </span>
              <span
                v-if="golfSettings.roundLayout?.venueName || currentRoundPar != null"
                class="opacity-85"
              >
                <strong v-if="golfSettings.roundLayout?.venueName">{{ golfSettings.roundLayout.venueName }}</strong>
                <span v-if="golfSettings.roundLayout?.layoutName"> · {{ golfSettings.roundLayout.layoutName }}</span>
                <span v-if="currentRoundPar != null"> · Par {{ currentRoundPar }}</span>
              </span>
              <span
                v-else
                class="opacity-70"
              >
                No course par configured for round {{ selectedRoundNumber }} (optional).
              </span>
            </div>

            <div class="flex items-center gap-2">
              <span class="badge badge-sm badge-outline">
                {{ scoredPlayerCount }} / {{ state?.players.length ?? 0 }} scored
              </span>
              <button
                type="button"
                class="btn btn-xs btn-ghost"
                :disabled="loading || saving"
                @click="loadScores"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>
      </template>

      <template #entry>
        <div class="space-y-3">
          <div
            v-if="!loading && state && !startingListStatus.canEnterScores"
            role="alert"
            class="alert alert-warning flex flex-wrap items-center justify-between gap-2"
          >
            <div class="flex items-center gap-2 text-sm">
              <Icon
                name="tabler:lock-open"
                size="18"
                class="shrink-0"
              />
              <span v-if="!startingListStatus.hasStartingList">
                Round {{ selectedRoundNumber }} starting list has not been generated yet. Generate and lock it before entering scores.
              </span>
              <span v-else-if="!startingListStatus.isLocked">
                Round {{ selectedRoundNumber }} starting list is not locked yet. Lock the starting list before entering scores.
              </span>
              <span v-else>
                You do not have scorer permission to edit scores for this tournament.
              </span>
            </div>
            <NuxtLink
              v-if="canManage && (!startingListStatus.hasStartingList || !startingListStatus.isLocked)"
              :to="`/dashboard/tournaments/${slug}/starting-lists`"
              class="btn btn-xs btn-neutral"
            >
              Open starting lists
            </NuxtLink>
          </div>

          <div
            v-if="canEditRoundScores"
            class="flex flex-wrap items-center justify-between gap-2"
          >
            <p class="text-xs opacity-70">
              Tip: press Enter after typing strokes to jump straight to the next player.
            </p>
            <button
              type="button"
              class="btn btn-sm btn-primary"
              :disabled="saving || !hasUnsavedChanges"
              @click="saveScores"
            >
              <span
                v-if="saving"
                class="loading loading-spinner loading-xs"
              />
              <span v-else>Save scores</span>
            </button>
          </div>

          <PageLoadingState
            v-if="loading"
            wrapper-class="py-8"
          />

          <EmptyStateAlert
            v-else-if="visiblePlayers.length === 0"
            message="No disc golf players match the current filters."
          />

          <div
            v-else
            class="overflow-x-auto rounded-box border border-base-300/60"
          >
            <table class="table table-sm">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>#</th>
                  <th>Division</th>
                  <th v-if="(golfSettings?.poolCount ?? 1) > 1">
                    Pool
                  </th>
                  <th class="w-28">
                    Strokes
                  </th>
                  <th
                    v-if="currentRoundPar != null"
                    class="w-20 text-center"
                  >
                    +/- Par
                  </th>
                  <th class="w-48">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(p, idx) in visiblePlayers"
                  :key="p.eventEntryId"
                >
                  <td>
                    <div class="font-medium">
                      {{ p.playerName }}
                    </div>
                    <div
                      v-if="p.country"
                      class="text-xs opacity-60"
                    >
                      {{ p.country }}
                    </div>
                  </td>
                  <td class="font-mono text-xs opacity-75">
                    {{ p.playerNumber ?? "—" }}
                  </td>
                  <td>
                    <span class="badge badge-sm badge-outline">
                      {{ p.majorDivision }}
                    </span>
                  </td>
                  <td v-if="(golfSettings?.poolCount ?? 1) > 1">
                    <span
                      class="badge badge-sm"
                      :class="p.poolName ? 'badge-secondary' : 'badge-ghost'"
                    >
                      {{ p.poolName || "Unassigned" }}
                    </span>
                  </td>
                  <td>
                    <input
                      :id="`golf-score-${p.eventEntryId}`"
                      v-model="drafts[p.eventEntryId]!.strokes"
                      type="number"
                      min="10"
                      max="300"
                      step="1"
                      placeholder="—"
                      class="input input-bordered input-sm w-24 font-mono"
                      :disabled="!canEditRoundScores || saving"
                      @input="onStrokesInput(p.eventEntryId)"
                      @keydown.enter.prevent="focusNextScoreInput(idx)"
                    >
                  </td>
                  <td
                    v-if="currentRoundPar != null"
                    class="text-center font-mono text-xs"
                    :class="relativeToParClass(getDraftRelativeToPar(p.eventEntryId))"
                  >
                    {{ formatRelativeToPar(getDraftRelativeToPar(p.eventEntryId)) }}
                  </td>
                  <td>
                    <div class="flex items-center gap-1">
                      <button
                        v-for="st in (['ok', 'DNS', 'DNF', 'SCR'] as const)"
                        :key="st"
                        type="button"
                        class="btn btn-xs px-2"
                        :class="drafts[p.eventEntryId]?.status === st
                          ? (st === 'ok' ? 'btn-primary' : 'btn-warning')
                          : 'btn-ghost border border-base-300'"
                        :disabled="!canEditRoundScores || saving"
                        @click="setRowStatus(p.eventEntryId, st)"
                      >
                        {{ st === "ok" ? "OK" : st }}
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div
            v-if="canEditRoundScores && visiblePlayers.length > 0"
            class="flex justify-end pt-1"
          >
            <button
              type="button"
              class="btn btn-sm btn-primary"
              :disabled="saving || !hasUnsavedChanges"
              @click="saveScores"
            >
              <span
                v-if="saving"
                class="loading loading-spinner loading-xs"
              />
              <span v-else>Save scores</span>
            </button>
          </div>
        </div>
      </template>

      <template #standings>
        <div class="space-y-4">
          <!-- Playoff tie-breaker card (podium places 1–3) -->
          <div
            v-if="state && state.podiumTies.length > 0"
            class="rounded-box bg-warning/10 border border-warning/40 p-4 space-y-3"
          >
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 class="text-sm font-semibold">
                  Podium playoff tie-breakers (places 1–3)
                </h3>
                <p class="text-xs opacity-75">
                  Assign playoff finish order (1 = winner, 2 = runner-up, etc.) to break podium ties.
                </p>
              </div>
              <button
                v-if="canManage"
                type="button"
                class="btn btn-xs btn-warning"
                :disabled="savingPlayoffs"
                @click="savePlayoffs"
              >
                <span
                  v-if="savingPlayoffs"
                  class="loading loading-spinner loading-xs"
                />
                <span v-else>Save playoffs</span>
              </button>
            </div>

            <div class="space-y-3">
              <div
                v-for="group in state.podiumTies"
                :key="`${group.division}-${group.baseRank}-${group.totalStrokes}`"
                class="rounded-lg bg-base-100 border border-base-300/60 p-3 space-y-2"
              >
                <div class="text-xs font-semibold">
                  {{ group.division }} · Tied for #{{ group.baseRank }} ({{ group.totalStrokes }} strokes)
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  <div
                    v-for="tp in group.players"
                    :key="tp.eventEntryId"
                    class="flex items-center justify-between gap-2 bg-base-200/60 rounded-lg px-3 py-1.5"
                  >
                    <span class="text-sm font-medium truncate">{{ tp.playerName }}</span>
                    <input
                      v-model="playoffDrafts[tp.eventEntryId]"
                      type="number"
                      min="1"
                      max="10"
                      placeholder="Rank"
                      class="input input-bordered input-xs w-16 font-mono"
                      :disabled="!canManage || savingPlayoffs"
                    >
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="max-w-xs">
            <FormField label="Division">
              <SearchableSelect
                :model-value="standingsDivisionFilter"
                :options="divisionFilterOptions"
                size="sm"
                placeholder="All divisions"
                @update:model-value="standingsDivisionFilter = $event || 'all'"
              />
            </FormField>
          </div>

          <EmptyStateAlert
            v-if="standingsByDivision.length === 0"
            message="No standings available yet."
          />

          <div
            v-else
            class="space-y-4"
          >
            <div
              v-for="group in standingsByDivision"
              :key="group.division"
              class="rounded-box border border-base-300/60 overflow-hidden"
            >
              <div class="px-3.5 py-2 bg-base-200/80 border-b border-base-300/60 flex items-center justify-between">
                <h3 class="text-sm font-semibold">
                  {{ group.division }}
                </h3>
                <span class="badge badge-sm badge-ghost">
                  {{ group.rows.length }} {{ group.rows.length === 1 ? "player" : "players" }}
                </span>
              </div>

              <div class="overflow-x-auto">
                <table class="table table-sm">
                  <thead>
                    <tr>
                      <th class="w-16">
                        Pos
                      </th>
                      <th>Player</th>
                      <th
                        v-for="r in (golfSettings?.rounds ?? 1)"
                        :key="r"
                        class="text-center w-16"
                      >
                        R{{ r }}
                      </th>
                      <th class="text-center w-20">
                        Total
                      </th>
                      <th class="text-center w-20">
                        +/- Par
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="row in group.rows"
                      :key="row.eventEntryId"
                    >
                      <td class="font-mono text-xs font-semibold">
                        <template v-if="row.rank != null">
                          {{ row.isTied ? `T${row.rank}` : row.rank }}<span
                            v-if="row.resolvedByPlayoff"
                            class="text-warning ml-0.5"
                            title="Decided by playoff"
                          >*</span>
                        </template>
                        <span
                          v-else
                          class="opacity-60"
                        >{{ row.overallStatus === "pending" ? "—" : row.overallStatus }}</span>
                      </td>
                      <td>
                        <span class="font-medium">{{ row.playerName }}</span>
                        <span
                          v-if="row.country"
                          class="text-xs opacity-60 ml-1.5"
                        >{{ row.country }}</span>
                      </td>
                      <td
                        v-for="cell in row.rounds"
                        :key="cell.roundNumber"
                        class="text-center font-mono text-xs"
                      >
                        <span v-if="cell.status !== 'ok'" class="badge badge-xs badge-warning badge-outline">
                          {{ cell.status }}
                        </span>
                        <span v-else>{{ cell.strokes ?? "—" }}</span>
                      </td>
                      <td class="text-center font-mono font-semibold">
                        {{ row.totalStrokes ?? "—" }}
                      </td>
                      <td
                        class="text-center font-mono text-xs"
                        :class="relativeToParClass(row.relativeToPar)"
                      >
                        {{ formatRelativeToPar(row.relativeToPar) }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </template>
    </VerticalTabsLayout>

    <ConfirmationModal
      :open="showLeaveConfirmModal"
      :title="modalTitle"
      :message="modalMessage"
      :confirm-text="modalConfirmText"
      :cancel-text="modalCancelText"
      :is-dangerous="true"
      @confirm="confirmLeavePage"
      @cancel="cancelLeavePage"
    />
  </div>
</template>
