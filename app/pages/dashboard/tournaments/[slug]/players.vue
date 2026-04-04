<script setup lang="ts">
type RegistrationLockState = {
  isLocked: boolean;
  lockedBy: string | null;
  lockedAt: number | null;
};

type RegistrationLockResponse = {
  tournamentId: number;
  hasStarted: boolean;
  lock: RegistrationLockState;
};

type TournamentPlayerNumberRow = {
  playerId: string;
  playerName: string | null;
  userName: string | null;
  userCountry: string | null;
  userEmail: string | null;
  entryCount: number;
  playerNumber: number | null;
  assignmentMode: string | null;
  assignedAt: number | null;
};

type PlayerNumbersResponse = {
  tournamentId: number;
  hasAnyAssignments: boolean;
  canAutoGenerate: boolean;
  summary: {
    registeredPlayers: number;
    assignedPlayers: number;
    unassignedPlayers: number;
  };
  players: TournamentPlayerNumberRow[];
};

definePageMeta({ ssr: false, layout: "tournament-admin" });

const route = useRoute();
const slug = computed(() => route.params.slug as string);

const registrationLock = ref<RegistrationLockResponse | null>(null);
const registrationLockLoading = ref(false);
const registrationLockSaving = ref(false);
const registrationLockError = ref<string | null>(null);
const registrationLockSuccess = ref<string | null>(null);

const playerNumbers = ref<PlayerNumbersResponse | null>(null);
const playerNumbersLoading = ref(false);
const playerNumbersBusy = ref(false);
const playerNumbersError = ref<string | null>(null);
const playerNumbersSuccess = ref<string | null>(null);
const playerNumberStartAt = ref(1000);
const playerNumberGap = ref(10);
const manualNumberDraft = ref<Record<string, number | null>>({});
const showOnlyUnassigned = ref(true);
const showGenerateConfirmModal = ref(false);

function getApiErrorMessage(error: any, fallback: string) {
  return error?.data?.message || error?.message || fallback;
}

function formatTimestamp(timestamp: number | null | undefined) {
  if (!timestamp) {
    return "—";
  }
  return new Date(timestamp).toLocaleString();
}

const visiblePlayerRows = computed(() => {
  const rows = playerNumbers.value?.players ?? [];
  if (!showOnlyUnassigned.value) {
    return rows;
  }

  return rows.filter(row => row.playerNumber == null);
});

function getDisplayPlayerName(row: TournamentPlayerNumberRow) {
  return row.playerName || row.userName || row.userEmail || row.playerId;
}

async function loadRegistrationLock() {
  registrationLockLoading.value = true;
  registrationLockError.value = null;
  try {
    registrationLock.value = await $fetch<RegistrationLockResponse>(`/api/tournaments/${slug.value}/registration-lock`);
  }
  catch (error: any) {
    registrationLockError.value = getApiErrorMessage(error, "Failed to load registration lock state.");
  }
  finally {
    registrationLockLoading.value = false;
  }
}

async function setRegistrationLock(locked: boolean) {
  registrationLockSaving.value = true;
  registrationLockError.value = null;
  registrationLockSuccess.value = null;
  try {
    const result = await $fetch<RegistrationLockResponse>(`/api/tournaments/${slug.value}/registration-lock`, {
      method: "PATCH",
      body: { locked },
    });
    registrationLock.value = {
      tournamentId: result.tournamentId,
      hasStarted: registrationLock.value?.hasStarted ?? false,
      lock: result.lock,
    };
    registrationLockSuccess.value = locked ? "Registration locked." : "Registration unlocked.";
  }
  catch (error: any) {
    registrationLockError.value = getApiErrorMessage(error, "Failed to update registration lock.");
  }
  finally {
    registrationLockSaving.value = false;
  }
}

async function loadPlayerNumbers() {
  playerNumbersLoading.value = true;
  playerNumbersError.value = null;
  try {
    playerNumbers.value = await $fetch<PlayerNumbersResponse>(`/api/tournaments/${slug.value}/player-numbers`);

    const nextDraft: Record<string, number | null> = {};
    for (const row of playerNumbers.value.players) {
      nextDraft[row.playerId] = row.playerNumber ?? null;
    }
    manualNumberDraft.value = nextDraft;
  }
  catch (error: any) {
    playerNumbersError.value = getApiErrorMessage(error, "Failed to load player numbers.");
  }
  finally {
    playerNumbersLoading.value = false;
  }
}

async function generatePlayerNumbers() {
  playerNumbersBusy.value = true;
  playerNumbersError.value = null;
  playerNumbersSuccess.value = null;
  try {
    await $fetch(`/api/tournaments/${slug.value}/player-numbers/generate`, {
      method: "POST",
      body: {
        startAt: playerNumberStartAt.value,
        gap: playerNumberGap.value,
      },
    });
    playerNumbersSuccess.value = "Tournament player numbers generated.";
    await loadPlayerNumbers();
  }
  catch (error: any) {
    playerNumbersError.value = getApiErrorMessage(error, "Failed to generate tournament player numbers.");
  }
  finally {
    playerNumbersBusy.value = false;
  }
}

function requestGeneratePlayerNumbers() {
  if (playerNumbersLoading.value || playerNumbersBusy.value || !playerNumbers.value?.canAutoGenerate) {
    return;
  }
  showGenerateConfirmModal.value = true;
}

function cancelGeneratePlayerNumbers() {
  showGenerateConfirmModal.value = false;
}

async function confirmGeneratePlayerNumbers() {
  showGenerateConfirmModal.value = false;
  await generatePlayerNumbers();
}

async function assignManualPlayerNumber(playerId: string) {
  const playerNumber = manualNumberDraft.value[playerId];
  if (!playerNumber || playerNumber < 1) {
    playerNumbersError.value = "Enter a valid player number before assigning.";
    return;
  }

  playerNumbersBusy.value = true;
  playerNumbersError.value = null;
  playerNumbersSuccess.value = null;
  try {
    await $fetch(`/api/tournaments/${slug.value}/player-numbers/assign`, {
      method: "POST",
      body: {
        playerId,
        playerNumber,
      },
    });
    playerNumbersSuccess.value = "Player number assigned.";
    await loadPlayerNumbers();
  }
  catch (error: any) {
    playerNumbersError.value = getApiErrorMessage(error, "Failed to assign player number.");
  }
  finally {
    playerNumbersBusy.value = false;
  }
}

watch(
  () => slug.value,
  async (currentSlug) => {
    if (!currentSlug) {
      return;
    }
    await Promise.all([
      loadRegistrationLock(),
      loadPlayerNumbers(),
    ]);
  },
  { immediate: true },
);
</script>

<template>
  <div class="space-y-3">
    <FormHeader
      title="Players"
      title-tag="h1"
      title-class="text-2xl font-bold"
      wrapper-class="mb-0"
      description="Registration controls and player entry operations."
    />

    <div class="card bg-base-200 shadow-sm border border-base-300/60">
      <div class="card-body space-y-3">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h3 class="font-semibold">
              Registration Lock
            </h3>
            <p class="text-xs opacity-70">
              Tournament-level registration control (TD/admin discretion after start).
            </p>
          </div>
          <span
            class="badge"
            :class="registrationLock?.lock.isLocked ? 'badge-warning' : 'badge-success'"
          >
            {{ registrationLock?.lock.isLocked ? 'Locked' : 'Unlocked' }}
          </span>
        </div>

        <p
          v-if="registrationLock"
          class="text-xs opacity-80"
        >
          Tournament started: <strong>{{ registrationLock.hasStarted ? "Yes" : "No" }}</strong>
          · Locked by: <strong>{{ registrationLock.lock.lockedBy || "—" }}</strong>
          · Locked at: <strong>{{ formatTimestamp(registrationLock.lock.lockedAt) }}</strong>
        </p>

        <div
          v-if="registrationLockError"
          class="alert alert-error py-2"
        >
          <span class="text-sm">{{ registrationLockError }}</span>
        </div>

        <div
          v-if="registrationLockSuccess"
          class="alert alert-success py-2"
        >
          <span class="text-sm">{{ registrationLockSuccess }}</span>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <button
            class="btn btn-sm btn-warning"
            :disabled="registrationLockLoading || registrationLockSaving || !!registrationLock?.lock.isLocked"
            type="button"
            @click="setRegistrationLock(true)"
          >
            <span
              v-if="registrationLockSaving"
              class="loading loading-spinner loading-xs"
            />
            <span v-else>Lock Registration</span>
          </button>
          <button
            class="btn btn-sm btn-outline"
            :disabled="registrationLockLoading || registrationLockSaving || !registrationLock?.lock.isLocked"
            type="button"
            @click="setRegistrationLock(false)"
          >
            Unlock Registration
          </button>
          <button
            class="btn btn-sm btn-ghost"
            :disabled="registrationLockLoading || registrationLockSaving"
            type="button"
            @click="loadRegistrationLock"
          >
            Refresh
          </button>
        </div>
      </div>
    </div>

    <div class="card bg-base-200 shadow-sm border border-base-300/60">
      <div class="card-body space-y-3">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h3 class="font-semibold">
              Tournament Player Numbers
            </h3>
            <p class="text-xs opacity-70">
              Stable athlete numbers for this tournament. Generate once with gaps, then manually assign only for newly added players.
            </p>
          </div>
          <div class="text-right text-xs opacity-80">
            <p>Registered: <strong>{{ playerNumbers?.summary.registeredPlayers ?? 0 }}</strong></p>
            <p>Assigned: <strong>{{ playerNumbers?.summary.assignedPlayers ?? 0 }}</strong></p>
            <p>Unassigned: <strong>{{ playerNumbers?.summary.unassignedPlayers ?? 0 }}</strong></p>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <FormField label="Start number">
            <input
              v-model.number="playerNumberStartAt"
              class="input input-bordered w-full"
              type="number"
              min="1"
              :disabled="playerNumbersBusy || !playerNumbers?.canAutoGenerate"
            >
          </FormField>
          <FormField label="Gap size">
            <input
              v-model.number="playerNumberGap"
              class="input input-bordered w-full"
              type="number"
              min="1"
              :disabled="playerNumbersBusy || !playerNumbers?.canAutoGenerate"
            >
          </FormField>
          <div class="flex items-end">
            <button
              class="btn btn-sm btn-primary w-full"
              :disabled="playerNumbersLoading || playerNumbersBusy || !playerNumbers?.canAutoGenerate"
              type="button"
              @click="requestGeneratePlayerNumbers"
            >
              Generate Once
            </button>
          </div>
        </div>

        <p
          v-if="playerNumbers && !playerNumbers.canAutoGenerate"
          class="text-xs opacity-70"
        >
          Auto-generation is disabled because numbers are already initialized. Only manual assignment for unassigned players is allowed.
        </p>

        <div
          v-if="playerNumbersError"
          class="alert alert-error py-2"
        >
          <span class="text-sm">{{ playerNumbersError }}</span>
        </div>

        <div
          v-if="playerNumbersSuccess"
          class="alert alert-success py-2"
        >
          <span class="text-sm">{{ playerNumbersSuccess }}</span>
        </div>

        <div class="flex items-center justify-between gap-2">
          <label class="label cursor-pointer gap-2">
            <span class="label-text text-sm">Show only unassigned</span>
            <input
              v-model="showOnlyUnassigned"
              type="checkbox"
              class="toggle toggle-sm"
            >
          </label>

          <button
            class="btn btn-sm btn-ghost"
            :disabled="playerNumbersLoading || playerNumbersBusy"
            type="button"
            @click="loadPlayerNumbers"
          >
            Refresh
          </button>
        </div>

        <PageLoadingState
          v-if="playerNumbersLoading"
          wrapper-class="py-8"
        />

        <div
          v-else
          class="overflow-x-auto"
        >
          <table class="table table-sm">
            <thead>
              <tr>
                <th>Player</th>
                <th>Country</th>
                <th>Entries</th>
                <th>Number</th>
                <th>Mode</th>
                <th>Assigned</th>
                <th>Manual Assign</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in visiblePlayerRows"
                :key="row.playerId"
              >
                <td>{{ getDisplayPlayerName(row) }}</td>
                <td>{{ row.userCountry || "—" }}</td>
                <td>{{ row.entryCount }}</td>
                <td>{{ row.playerNumber ?? "—" }}</td>
                <td>{{ row.assignmentMode || "—" }}</td>
                <td>{{ formatTimestamp(row.assignedAt) }}</td>
                <td>
                  <div
                    v-if="row.playerNumber == null"
                    class="flex items-center gap-2"
                  >
                    <input
                      v-model.number="manualNumberDraft[row.playerId]"
                      class="input input-bordered input-xs w-24"
                      type="number"
                      min="1"
                      :disabled="playerNumbersBusy"
                    >
                    <button
                      class="btn btn-xs btn-outline"
                      :disabled="playerNumbersBusy"
                      type="button"
                      @click="assignManualPlayerNumber(row.playerId)"
                    >
                      Assign
                    </button>
                  </div>
                  <span v-else class="text-xs opacity-60">Assigned</span>
                </td>
              </tr>
              <tr v-if="visiblePlayerRows.length === 0">
                <td colspan="7" class="text-center text-sm opacity-70 py-4">
                  No players match the current filter.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <ConfirmationModal
      :open="showGenerateConfirmModal"
      title="Generate tournament player numbers"
      :message="`This will assign stable player numbers once for all currently registered players (start: ${playerNumberStartAt}, gap: ${playerNumberGap}). After this, auto-generation is disabled and only manual assignment for new players is allowed.`"
      confirm-text="Generate now"
      cancel-text="Cancel"
      :is-dangerous="true"
      @confirm="confirmGeneratePlayerNumbers"
      @cancel="cancelGeneratePlayerNumbers"
    />
  </div>
</template>
