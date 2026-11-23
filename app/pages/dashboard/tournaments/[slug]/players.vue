<script setup lang="ts">
import type { TournamentEntriesResponse, TournamentPlayerGroup } from "~/types/tournament-registration";

type RegistrationLockState = {
  isLocked: boolean;
  lockedBy: string | null;
  lockedAt: number | null;
};

type RegistrationLockResponse = {
  tournamentId: number;
  hasStarted: boolean;
  registrationOpenDate?: number | null;
  registrationCloseDate?: number | null;
  isRegistrationOpen?: boolean;
  registrationStatusReason?: string;
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

// Entries & Player Management State
const entriesData = ref<TournamentEntriesResponse | null>(null);
const entriesLoading = ref(false);
const entriesBusy = ref(false);
const entriesError = ref<string | null>(null);
const entriesSuccess = ref<string | null>(null);

const showRegisterForm = ref(false);
const editingPlayer = ref<TournamentPlayerGroup | null>(null);

// Registration Lock State
const registrationLock = ref<RegistrationLockResponse | null>(null);
const registrationLockLoading = ref(false);
const registrationLockSaving = ref(false);
const registrationLockError = ref<string | null>(null);
const registrationLockSuccess = ref<string | null>(null);

// Player Numbers State
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

function formatTimestamp(timestamp: number | null | undefined) {
  if (!timestamp) {
    return "—";
  }
  return new Date(timestamp).toLocaleString();
}

const activePlayerCount = computed(() =>
  (entriesData.value?.players ?? []).filter(p => p.overallStatus === "registered").length,
);

const withdrawnPlayerCount = computed(() =>
  (entriesData.value?.players ?? []).filter(p => p.overallStatus === "withdrawn").length,
);

const canManagePlayers = computed(() => !!entriesData.value?.canManage);

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

function toggleNewPlayerForm() {
  if (showRegisterForm.value && !editingPlayer.value) {
    showRegisterForm.value = false;
    return;
  }
  editingPlayer.value = null;
  showRegisterForm.value = true;
  entriesError.value = null;
  entriesSuccess.value = null;
}

function startEditingPlayer(player: TournamentPlayerGroup) {
  editingPlayer.value = player;
  showRegisterForm.value = true;
  entriesError.value = null;
  entriesSuccess.value = null;
}

function closeRegisterForm() {
  showRegisterForm.value = false;
  editingPlayer.value = null;
}

async function handlePlayerSaved(message: string) {
  showRegisterForm.value = false;
  editingPlayer.value = null;
  entriesSuccess.value = message;
  await Promise.all([loadEntries(), loadPlayerNumbers()]);
}

async function loadEntries() {
  entriesLoading.value = true;
  entriesError.value = null;
  try {
    entriesData.value = await $fetch<TournamentEntriesResponse>(`/api/tournaments/${slug.value}/entries`);
  }
  catch (error: unknown) {
    entriesError.value = getApiErrorMessage(error, "Failed to load tournament player entries.");
  }
  finally {
    entriesLoading.value = false;
  }
}

async function togglePlayerWithdrawal(p: TournamentPlayerGroup) {
  if (entriesBusy.value) {
    return;
  }

  entriesError.value = null;
  entriesSuccess.value = null;
  entriesBusy.value = true;

  const targetStatus = p.overallStatus === "registered" ? "withdrawn" : "registered";
  const restoreDisciplines = targetStatus === "registered"
    ? (p.withdrawnDisciplines.length > 0
        ? p.withdrawnDisciplines
        : (entriesData.value?.enabledDisciplines ?? []).map(d => d.key))
    : undefined;

  try {
    await $fetch(`/api/tournaments/${slug.value}/entries/${p.playerId}`, {
      method: "PATCH",
      body: {
        status: targetStatus,
        disciplines: restoreDisciplines,
      },
    });
    entriesSuccess.value = targetStatus === "withdrawn"
      ? `${p.displayName} marked as withdrawn.`
      : `${p.displayName} restored to registered.`;
    await Promise.all([loadEntries(), loadPlayerNumbers()]);
  }
  catch (error: unknown) {
    entriesError.value = getApiErrorMessage(error, "Failed to update player status.");
  }
  finally {
    entriesBusy.value = false;
  }
}

async function loadRegistrationLock() {
  registrationLockLoading.value = true;
  registrationLockError.value = null;
  try {
    registrationLock.value = await $fetch<RegistrationLockResponse>(`/api/tournaments/${slug.value}/registration-lock`);
  }
  catch (error: unknown) {
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
      ...registrationLock.value,
      tournamentId: result.tournamentId,
      hasStarted: registrationLock.value?.hasStarted ?? false,
      lock: result.lock,
    };
    registrationLockSuccess.value = locked ? "Registration locked." : "Registration unlocked.";
  }
  catch (error: unknown) {
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
  catch (error: unknown) {
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
    await Promise.all([loadPlayerNumbers(), loadEntries()]);
  }
  catch (error: unknown) {
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
    await Promise.all([loadPlayerNumbers(), loadEntries()]);
  }
  catch (error: unknown) {
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
      loadEntries(),
      loadRegistrationLock(),
      loadPlayerNumbers(),
    ]);
  },
  { immediate: true },
);
</script>

<template>
  <div class="space-y-4">
    <FormHeader
      title="Players & registration"
      title-tag="h1"
      title-class="text-2xl font-bold"
      wrapper-class="mb-0"
      description="Manage registered players, offline/guest entries, discipline selections, and player numbers."
    />

    <!-- Registered Players & Discipline Entries Card -->
    <div class="card bg-base-200 shadow-sm border border-base-300/60">
      <div class="card-body space-y-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2
              id="registered-players-heading"
              class="text-lg font-semibold"
            >
              Registered players & discipline entries
            </h2>
            <p class="text-xs opacity-70">
              Register existing users or offline guest players, edit divisions and disciplines, or process withdrawals.
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <span class="badge badge-success badge-sm">
              Active: {{ activePlayerCount }}
            </span>
            <span
              v-if="withdrawnPlayerCount > 0"
              class="badge badge-ghost badge-sm"
            >
              Withdrawn: {{ withdrawnPlayerCount }}
            </span>
            <button
              v-if="canManagePlayers"
              type="button"
              class="btn btn-sm btn-primary gap-1.5"
              @click="toggleNewPlayerForm"
            >
              <Icon
                :name="showRegisterForm && !editingPlayer ? 'tabler:x' : 'tabler:user-plus'"
                size="16"
              />
              {{ showRegisterForm && !editingPlayer ? "Close form" : "Register player" }}
            </button>
          </div>
        </div>

        <FlashAlert
          :message="entriesError"
          type="error"
          role="alert"
          :auto-hide-ms="0"
          @dismiss="entriesError = null"
        />

        <FlashAlert
          :message="entriesSuccess"
          type="success"
          role="status"
          @dismiss="entriesSuccess = null"
        />

        <PlayerRegistrationForm
          v-if="showRegisterForm && entriesData"
          :slug="slug"
          :major-divisions="entriesData.majorDivisions"
          :enabled-disciplines="entriesData.enabledDisciplines"
          :editing-player="editingPlayer"
          @saved="handlePlayerSaved"
          @cancel="closeRegisterForm"
        />

        <RegisteredPlayersTable
          :players="entriesData?.players ?? []"
          :major-divisions="entriesData?.majorDivisions ?? []"
          :enabled-disciplines="entriesData?.enabledDisciplines ?? []"
          :loading="entriesLoading"
          :busy="entriesBusy"
          :can-manage="canManagePlayers"
          @edit="startEditingPlayer"
          @toggle-withdrawal="togglePlayerWithdrawal"
          @refresh="loadEntries"
        />
      </div>
    </div>

    <!-- Registration Lock Card -->
    <div class="card bg-base-200 shadow-sm border border-base-300/60">
      <div class="card-body space-y-3">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h3 class="font-semibold">
              Registration lock
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
          Public self-registration open: <strong>{{ registrationLock.isRegistrationOpen ? "Yes" : `No (${registrationLock.registrationStatusReason || "closed"})` }}</strong>
          · Tournament started: <strong>{{ registrationLock.hasStarted ? "Yes" : "No" }}</strong>
          · Locked by: <strong>{{ registrationLock.lock.lockedBy || "—" }}</strong>
          · Locked at: <strong>{{ formatTimestamp(registrationLock.lock.lockedAt) }}</strong>
        </p>

        <FlashAlert
          :message="registrationLockError"
          type="error"
          role="alert"
          :auto-hide-ms="0"
          @dismiss="registrationLockError = null"
        />

        <FlashAlert
          :message="registrationLockSuccess"
          type="success"
          role="status"
          @dismiss="registrationLockSuccess = null"
        />

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
            <span v-else>Lock registration</span>
          </button>
          <button
            class="btn btn-sm btn-outline"
            :disabled="registrationLockLoading || registrationLockSaving || !registrationLock?.lock.isLocked"
            type="button"
            @click="setRegistrationLock(false)"
          >
            Unlock registration
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

    <!-- Tournament Player Numbers Card -->
    <div class="card bg-base-200 shadow-sm border border-base-300/60">
      <div class="card-body space-y-3">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h3 class="font-semibold">
              Tournament player numbers
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
              Generate once
            </button>
          </div>
        </div>

        <p
          v-if="playerNumbers && !playerNumbers.canAutoGenerate"
          class="text-xs opacity-70"
        >
          Auto-generation is disabled because numbers are already initialized. Only manual assignment for unassigned players is allowed.
        </p>

        <FlashAlert
          :message="playerNumbersError"
          type="error"
          role="alert"
          :auto-hide-ms="0"
          @dismiss="playerNumbersError = null"
        />

        <FlashAlert
          :message="playerNumbersSuccess"
          type="success"
          role="status"
          @dismiss="playerNumbersSuccess = null"
        />

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
          tabindex="0"
          role="region"
          aria-labelledby="player-numbers-caption"
          class="overflow-x-auto"
        >
          <table class="table table-sm">
            <caption
              id="player-numbers-caption"
              class="sr-only"
            >
              Tournament player number assignments
            </caption>
            <thead>
              <tr>
                <th>Player</th>
                <th>Country</th>
                <th>Entries</th>
                <th>Number</th>
                <th>Mode</th>
                <th>Assigned</th>
                <th>Manual assign</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in visiblePlayerRows"
                :key="row.playerId"
              >
                <th
                  scope="row"
                  class="font-normal"
                >
                  {{ getDisplayPlayerName(row) }}
                </th>
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
                  <span
                    v-else
                    class="text-xs opacity-60"
                  >Assigned</span>
                </td>
              </tr>
              <tr v-if="visiblePlayerRows.length === 0">
                <td
                  colspan="7"
                  class="text-center text-sm opacity-70 py-4"
                >
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
