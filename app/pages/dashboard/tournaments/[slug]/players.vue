<script setup lang="ts">
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

type TournamentPlayerGroup = {
  playerId: string;
  userId: string | null;
  isGuest: boolean;
  displayName: string;
  country: string | null;
  email: string | null;
  pdgaNumber: string | null;
  homeClub: string | null;
  dateOfBirth: string | null;
  genderCategory: string | null;
  playerNumber: number | null;
  majorDivision: string;
  minorDivisionTags: string[];
  primaryMinorDivision: string | null;
  activeDisciplines: string[];
  withdrawnDisciplines: string[];
  overallStatus: "registered" | "withdrawn";
};

type AvailableUserItem = {
  id: string;
  name: string;
  email: string;
  country: string | null;
  pdgaNumber: string | null;
  homeClub: string | null;
  dateOfBirth: string | null;
  genderCategory: string | null;
};

type EntriesResponse = {
  tournamentId: number;
  majorDivisions: Array<{ code: string; label: string }>;
  enabledDisciplines: Array<{ key: string; label: string }>;
  players: TournamentPlayerGroup[];
  availableUsers: AvailableUserItem[];
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
const entriesData = ref<EntriesResponse | null>(null);
const entriesLoading = ref(false);
const entriesSaving = ref(false);
const entriesError = ref<string | null>(null);
const entriesSuccess = ref<string | null>(null);

const showRegisterForm = ref(false);
const registerMode = ref<"existing" | "guest">("guest");
const selectedUserId = ref("");
const editingPlayerId = ref<string | null>(null);

const formDisplayName = ref("");
const formCountry = ref("");
const formEmail = ref("");
const formDateOfBirth = ref("");
const formGenderCategory = ref<"open" | "women">("open");
const formPdgaNumber = ref("");
const formHomeClub = ref("");
const formMajorDivision = ref("OPEN");
const formSelectedDisciplines = ref<string[]>([]);

const playerSearchQuery = ref("");
const playerStatusFilter = ref<"all" | "registered" | "withdrawn">("all");
const playerDivisionFilter = ref("all");

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

function getApiErrorMessage(error: any, fallback: string) {
  return error?.data?.message || error?.message || fallback;
}

function formatTimestamp(timestamp: number | null | undefined) {
  if (!timestamp) {
    return "—";
  }
  return new Date(timestamp).toLocaleString();
}

const disciplineLabelByKey = computed(() => {
  const map = new Map<string, string>();
  for (const disc of entriesData.value?.enabledDisciplines ?? []) {
    map.set(disc.key, disc.label);
  }
  map.set("overall", "Overall");
  return map;
});

function getDisciplineLabel(key: string) {
  return disciplineLabelByKey.value.get(key) || key;
}

const activePlayerCount = computed(() =>
  (entriesData.value?.players ?? []).filter(p => p.overallStatus === "registered").length,
);

const withdrawnPlayerCount = computed(() =>
  (entriesData.value?.players ?? []).filter(p => p.overallStatus === "withdrawn").length,
);

const filteredPlayers = computed(() => {
  const list = entriesData.value?.players ?? [];
  const q = playerSearchQuery.value.trim().toLowerCase();

  return list.filter((item) => {
    if (playerStatusFilter.value !== "all" && item.overallStatus !== playerStatusFilter.value) {
      return false;
    }
    if (playerDivisionFilter.value !== "all" && item.majorDivision !== playerDivisionFilter.value) {
      return false;
    }
    if (!q) {
      return true;
    }
    return (
      item.displayName.toLowerCase().includes(q)
      || (item.country || "").toLowerCase().includes(q)
      || (item.email || "").toLowerCase().includes(q)
      || (item.pdgaNumber || "").toLowerCase().includes(q)
      || String(item.playerNumber || "").includes(q)
    );
  });
});

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

function resetPlayerForm() {
  editingPlayerId.value = null;
  selectedUserId.value = "";
  formDisplayName.value = "";
  formCountry.value = "";
  formEmail.value = "";
  formDateOfBirth.value = "";
  formGenderCategory.value = "open";
  formPdgaNumber.value = "";
  formHomeClub.value = "";
  formMajorDivision.value = entriesData.value?.majorDivisions?.[0]?.code || "OPEN";
  formSelectedDisciplines.value = (entriesData.value?.enabledDisciplines ?? []).map(d => d.key);
}

function openNewPlayerForm(mode: "existing" | "guest" = "guest") {
  resetPlayerForm();
  registerMode.value = mode;
  showRegisterForm.value = true;
  entriesError.value = null;
  entriesSuccess.value = null;
}

function startEditingPlayer(p: TournamentPlayerGroup) {
  editingPlayerId.value = p.playerId;
  registerMode.value = p.isGuest ? "guest" : "existing";
  selectedUserId.value = p.userId || "";
  formDisplayName.value = p.displayName || "";
  formCountry.value = p.country || "";
  formEmail.value = p.email || "";
  formDateOfBirth.value = p.dateOfBirth || "";
  formGenderCategory.value = (p.genderCategory === "women" ? "women" : "open");
  formPdgaNumber.value = p.pdgaNumber || "";
  formHomeClub.value = p.homeClub || "";
  formMajorDivision.value = p.majorDivision || entriesData.value?.majorDivisions?.[0]?.code || "OPEN";
  formSelectedDisciplines.value = p.activeDisciplines.length > 0
    ? [...p.activeDisciplines]
    : (entriesData.value?.enabledDisciplines ?? []).map(d => d.key);
  showRegisterForm.value = true;
  entriesError.value = null;
  entriesSuccess.value = null;
}

watch(selectedUserId, (newUserId) => {
  if (!newUserId || editingPlayerId.value) {
    return;
  }
  const found = entriesData.value?.availableUsers.find(u => u.id === newUserId);
  if (found) {
    formDisplayName.value = found.name || "";
    formCountry.value = found.country || "";
    formEmail.value = found.email || "";
    formDateOfBirth.value = found.dateOfBirth || "";
    formGenderCategory.value = found.genderCategory === "women" ? "women" : "open";
    formPdgaNumber.value = found.pdgaNumber || "";
    formHomeClub.value = found.homeClub || "";
  }
});

function selectAllFormDisciplines() {
  formSelectedDisciplines.value = (entriesData.value?.enabledDisciplines ?? []).map(d => d.key);
}

const isFormFullOverall = computed(() => {
  const enabled = entriesData.value?.enabledDisciplines ?? [];
  return enabled.length > 0 && enabled.every(d => formSelectedDisciplines.value.includes(d.key));
});

async function loadEntries() {
  entriesLoading.value = true;
  entriesError.value = null;
  try {
    entriesData.value = await $fetch<EntriesResponse>(`/api/tournaments/${slug.value}/entries`);
    if (!showRegisterForm.value) {
      resetPlayerForm();
    }
  }
  catch (error: any) {
    entriesError.value = getApiErrorMessage(error, "Failed to load tournament player entries.");
  }
  finally {
    entriesLoading.value = false;
  }
}

async function submitPlayerRegistration() {
  if (entriesSaving.value) {
    return;
  }

  entriesError.value = null;
  entriesSuccess.value = null;

  if (formSelectedDisciplines.value.length === 0) {
    entriesError.value = "Please select at least one discipline.";
    return;
  }

  const profilePayload = {
    displayName: formDisplayName.value.trim() || undefined,
    country: formCountry.value.trim() || null,
    email: formEmail.value.trim() || null,
    dateOfBirth: formDateOfBirth.value.trim() || null,
    genderCategory: formGenderCategory.value,
    pdgaNumber: formPdgaNumber.value.trim() || null,
    homeClub: formHomeClub.value.trim() || null,
  };

  entriesSaving.value = true;
  try {
    if (editingPlayerId.value) {
      await $fetch(`/api/tournaments/${slug.value}/entries/${editingPlayerId.value}`, {
        method: "PATCH",
        body: {
          majorDivision: formMajorDivision.value,
          disciplines: formSelectedDisciplines.value,
          status: "registered",
          profile: profilePayload,
        },
      });
      entriesSuccess.value = `Updated registration for ${formDisplayName.value || "player"}.`;
    }
    else if (registerMode.value === "existing") {
      if (!selectedUserId.value) {
        entriesError.value = "Please select an existing user account.";
        entriesSaving.value = false;
        return;
      }
      await $fetch(`/api/tournaments/${slug.value}/entries`, {
        method: "POST",
        body: {
          userId: selectedUserId.value,
          majorDivision: formMajorDivision.value,
          disciplines: formSelectedDisciplines.value,
          profile: profilePayload,
        },
      });
      entriesSuccess.value = `Registered ${formDisplayName.value || "player"}.`;
    }
    else {
      if (!formDisplayName.value.trim()) {
        entriesError.value = "Guest player display name is required.";
        entriesSaving.value = false;
        return;
      }
      await $fetch(`/api/tournaments/${slug.value}/entries`, {
        method: "POST",
        body: {
          majorDivision: formMajorDivision.value,
          disciplines: formSelectedDisciplines.value,
          guestPlayer: {
            ...profilePayload,
            displayName: formDisplayName.value.trim(),
          },
        },
      });
      entriesSuccess.value = `Registered guest player ${formDisplayName.value.trim()}.`;
    }

    showRegisterForm.value = false;
    resetPlayerForm();
    await Promise.all([loadEntries(), loadPlayerNumbers()]);
  }
  catch (error: any) {
    entriesError.value = getApiErrorMessage(error, "Failed to save player registration.");
  }
  finally {
    entriesSaving.value = false;
  }
}

async function togglePlayerWithdrawal(p: TournamentPlayerGroup) {
  if (entriesSaving.value) {
    return;
  }

  entriesError.value = null;
  entriesSuccess.value = null;
  entriesSaving.value = true;

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
  catch (error: any) {
    entriesError.value = getApiErrorMessage(error, "Failed to update player status.");
  }
  finally {
    entriesSaving.value = false;
  }
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
      ...registrationLock.value,
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
    await Promise.all([loadPlayerNumbers(), loadEntries()]);
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
    await Promise.all([loadPlayerNumbers(), loadEntries()]);
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
      title="Players & Registration"
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
              Registered Players & Discipline Entries
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
              type="button"
              class="btn btn-sm btn-primary gap-1.5"
              @click="showRegisterForm ? (showRegisterForm = false) : openNewPlayerForm('guest')"
            >
              <Icon
                :name="showRegisterForm ? 'tabler:x' : 'tabler:user-plus'"
                size="16"
              />
              {{ showRegisterForm ? "Close Form" : "Register Player" }}
            </button>
          </div>
        </div>

        <div
          v-if="entriesError"
          role="alert"
          aria-live="polite"
          class="alert alert-error py-2"
        >
          <span class="text-sm">{{ entriesError }}</span>
        </div>

        <div
          v-if="entriesSuccess"
          role="status"
          aria-live="polite"
          class="alert alert-success py-2"
        >
          <span class="text-sm">{{ entriesSuccess }}</span>
        </div>

        <!-- Register / Edit Player Form -->
        <form
          v-if="showRegisterForm"
          aria-labelledby="td-register-player-heading"
          class="bg-base-100 border border-base-300 rounded-box p-4 space-y-4"
          @submit.prevent="submitPlayerRegistration"
        >
          <div class="flex items-center justify-between gap-2">
            <h3
              id="td-register-player-heading"
              class="font-semibold text-base"
            >
              {{ editingPlayerId ? `Edit Registration: ${formDisplayName}` : "Register Player into Tournament" }}
            </h3>
            <button
              type="button"
              class="btn btn-xs btn-ghost"
              @click="showRegisterForm = false"
            >
              Cancel
            </button>
          </div>

          <!-- Registration Mode (only when adding a new player) -->
          <fieldset
            v-if="!editingPlayerId"
            class="flex flex-wrap items-center gap-6 border border-base-300 rounded-lg px-4 py-2.5"
          >
            <legend class="px-1 text-xs font-semibold uppercase tracking-wide opacity-75">
              Player Type
            </legend>
            <div class="flex items-center gap-2">
              <input
                id="mode-guest"
                v-model="registerMode"
                type="radio"
                name="registerMode"
                value="guest"
                class="radio radio-primary radio-sm"
              >
              <label
                for="mode-guest"
                class="text-sm font-medium cursor-pointer"
              >
                New Guest / Offline Player (No login account required)
              </label>
            </div>
            <div class="flex items-center gap-2">
              <input
                id="mode-existing"
                v-model="registerMode"
                type="radio"
                name="registerMode"
                value="existing"
                class="radio radio-primary radio-sm"
              >
              <label
                for="mode-existing"
                class="text-sm font-medium cursor-pointer"
              >
                Existing Platform User
              </label>
            </div>
          </fieldset>

          <!-- Existing User Picker -->
          <div
            v-if="!editingPlayerId && registerMode === 'existing'"
            class="flex flex-col gap-1"
          >
            <label
              for="td-select-user"
              class="text-sm font-medium"
            >
              Select Existing User <span aria-hidden="true">*</span>
            </label>
            <select
              id="td-select-user"
              v-model="selectedUserId"
              name="userId"
              required
              class="select select-bordered w-full"
            >
              <option
                value=""
                disabled
              >
                Choose a registered user...
              </option>
              <option
                v-for="u in entriesData?.availableUsers ?? []"
                :key="u.id"
                :value="u.id"
              >
                {{ u.name }} ({{ u.email }}){{ u.country ? ` · ${u.country}` : "" }}
              </option>
            </select>
          </div>

          <!-- Player Profile Fields -->
          <fieldset class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 border border-base-300 rounded-lg p-3">
            <legend class="px-2 text-xs font-semibold uppercase tracking-wide opacity-75">
              Player Details
            </legend>

            <div class="flex flex-col gap-1">
              <label
                for="td-player-name"
                class="text-xs font-medium"
              >
                Display Name <span aria-hidden="true">*</span>
              </label>
              <input
                id="td-player-name"
                v-model="formDisplayName"
                name="displayName"
                type="text"
                required
                class="input input-bordered input-sm w-full"
              >
            </div>

            <div class="flex flex-col gap-1">
              <label
                for="td-player-country"
                class="text-xs font-medium"
              >
                Country
              </label>
              <input
                id="td-player-country"
                v-model="formCountry"
                name="country"
                type="text"
                placeholder="e.g. Sweden"
                class="input input-bordered input-sm w-full"
              >
            </div>

            <div class="flex flex-col gap-1">
              <label
                for="td-player-email"
                class="text-xs font-medium"
              >
                Email (optional)
              </label>
              <input
                id="td-player-email"
                v-model="formEmail"
                name="email"
                type="email"
                autocorrect="off"
                autocapitalize="none"
                spellcheck="false"
                class="input input-bordered input-sm w-full"
              >
            </div>

            <div class="flex flex-col gap-1">
              <label
                for="td-player-dob"
                class="text-xs font-medium"
              >
                Date of Birth
              </label>
              <input
                id="td-player-dob"
                v-model="formDateOfBirth"
                name="dateOfBirth"
                type="date"
                class="input input-bordered input-sm w-full"
              >
            </div>

            <fieldset class="flex flex-col gap-1">
              <legend class="text-xs font-medium">
                Gender Category
              </legend>
              <div class="flex items-center gap-4 pt-1.5">
                <div class="flex items-center gap-1.5">
                  <input
                    id="td-gender-open"
                    v-model="formGenderCategory"
                    type="radio"
                    name="tdGenderCategory"
                    value="open"
                    class="radio radio-primary radio-xs"
                  >
                  <label
                    for="td-gender-open"
                    class="text-xs cursor-pointer"
                  >Open</label>
                </div>
                <div class="flex items-center gap-1.5">
                  <input
                    id="td-gender-women"
                    v-model="formGenderCategory"
                    type="radio"
                    name="tdGenderCategory"
                    value="women"
                    class="radio radio-primary radio-xs"
                  >
                  <label
                    for="td-gender-women"
                    class="text-xs cursor-pointer"
                  >Women</label>
                </div>
              </div>
            </fieldset>

            <div class="flex flex-col gap-1">
              <label
                for="td-player-pdga"
                class="text-xs font-medium"
              >
                PDGA #
              </label>
              <input
                id="td-player-pdga"
                v-model="formPdgaNumber"
                name="pdgaNumber"
                type="text"
                inputmode="numeric"
                class="input input-bordered input-sm w-full"
              >
            </div>

            <div class="flex flex-col gap-1 sm:col-span-2 md:col-span-3">
              <label
                for="td-player-club"
                class="text-xs font-medium"
              >
                Home Club
              </label>
              <input
                id="td-player-club"
                v-model="formHomeClub"
                name="homeClub"
                type="text"
                class="input input-bordered input-sm w-full"
              >
            </div>
          </fieldset>

          <!-- Major Division & Disciplines -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <fieldset class="border border-base-300 rounded-lg p-3 space-y-2">
              <legend class="px-2 text-xs font-semibold uppercase tracking-wide opacity-75">
                Major Division
              </legend>
              <div class="flex flex-wrap gap-3">
                <div
                  v-for="div in entriesData?.majorDivisions ?? []"
                  :key="div.code"
                  class="flex items-center gap-2"
                >
                  <input
                    :id="`td-major-${div.code}`"
                    v-model="formMajorDivision"
                    type="radio"
                    name="tdMajorDivision"
                    :value="div.code"
                    class="radio radio-primary radio-sm"
                  >
                  <label
                    :for="`td-major-${div.code}`"
                    class="text-sm font-medium cursor-pointer"
                  >
                    {{ div.label }}
                  </label>
                </div>
              </div>
            </fieldset>

            <fieldset class="border border-base-300 rounded-lg p-3 space-y-2">
              <legend class="px-2 text-xs font-semibold uppercase tracking-wide opacity-75">
                Disciplines
              </legend>
              <div class="flex items-center justify-between gap-2">
                <span class="text-xs opacity-70">Select disciplines to enter:</span>
                <button
                  type="button"
                  class="btn btn-xs"
                  :class="isFormFullOverall ? 'btn-secondary' : 'btn-outline'"
                  @click="selectAllFormDisciplines"
                >
                  Select All / Full Overall
                </button>
              </div>
              <div class="flex flex-wrap gap-3 pt-1">
                <div
                  v-for="disc in entriesData?.enabledDisciplines ?? []"
                  :key="disc.key"
                  class="flex items-center gap-1.5"
                >
                  <input
                    :id="`td-disc-${disc.key}`"
                    v-model="formSelectedDisciplines"
                    type="checkbox"
                    name="tdDisciplines"
                    :value="disc.key"
                    class="checkbox checkbox-primary checkbox-xs"
                  >
                  <label
                    :for="`td-disc-${disc.key}`"
                    class="text-xs font-medium cursor-pointer"
                  >
                    {{ disc.label }}
                  </label>
                </div>
              </div>
            </fieldset>
          </div>

          <div class="flex justify-end gap-2">
            <button
              type="button"
              class="btn btn-sm btn-ghost"
              @click="showRegisterForm = false"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="btn btn-sm btn-primary"
              :disabled="entriesSaving"
            >
              <span
                v-if="entriesSaving"
                class="loading loading-spinner loading-xs"
              />
              {{ editingPlayerId ? "Save Changes" : "Register Player" }}
            </button>
          </div>
        </form>

        <!-- Search & Filter Controls -->
        <search class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex flex-wrap items-center gap-2 flex-1">
            <label
              for="player-search-input"
              class="sr-only"
            >Search players</label>
            <input
              id="player-search-input"
              v-model="playerSearchQuery"
              type="search"
              placeholder="Search name, country, PDGA #, or player #..."
              class="input input-bordered input-sm w-full sm:w-64"
            >

            <label
              for="player-status-filter"
              class="sr-only"
            >Filter by status</label>
            <select
              id="player-status-filter"
              v-model="playerStatusFilter"
              class="select select-bordered select-sm"
            >
              <option value="all">
                All Statuses
              </option>
              <option value="registered">
                Registered Only
              </option>
              <option value="withdrawn">
                Withdrawn Only
              </option>
            </select>

            <label
              for="player-division-filter"
              class="sr-only"
            >Filter by division</label>
            <select
              id="player-division-filter"
              v-model="playerDivisionFilter"
              class="select select-bordered select-sm"
            >
              <option value="all">
                All Major Divisions
              </option>
              <option
                v-for="div in entriesData?.majorDivisions ?? []"
                :key="div.code"
                :value="div.code"
              >
                {{ div.label }}
              </option>
            </select>
          </div>

          <button
            type="button"
            class="btn btn-sm btn-ghost"
            :disabled="entriesLoading"
            @click="loadEntries"
          >
            Refresh
          </button>
        </search>

        <PageLoadingState
          v-if="entriesLoading"
          wrapper-class="py-8"
        />

        <!-- Registered Players Table -->
        <div
          v-else
          tabindex="0"
          role="region"
          aria-labelledby="registered-players-caption"
          class="overflow-x-auto"
        >
          <table class="table table-sm">
            <caption
              id="registered-players-caption"
              class="sr-only"
            >
              Registered tournament players and discipline entries
            </caption>
            <thead>
              <tr>
                <th>Player</th>
                <th>#</th>
                <th>Country</th>
                <th>Major Div</th>
                <th>Minor / Age Divs</th>
                <th>Disciplines</th>
                <th>Status</th>
                <th class="text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="p in filteredPlayers"
                :key="p.playerId"
                :class="p.overallStatus === 'withdrawn' ? 'opacity-60' : ''"
              >
                <td>
                  <div class="flex items-center gap-1.5 font-medium">
                    <span>{{ p.displayName }}</span>
                    <span
                      v-if="p.isGuest"
                      class="badge badge-outline badge-xs"
                    >
                      Guest
                    </span>
                  </div>
                  <div
                    v-if="p.pdgaNumber || p.homeClub"
                    class="text-xs opacity-60"
                  >
                    {{ [p.pdgaNumber ? `PDGA #${p.pdgaNumber}` : null, p.homeClub].filter(Boolean).join(" · ") }}
                  </div>
                </td>
                <td class="font-mono">
                  {{ p.playerNumber ?? "—" }}
                </td>
                <td>{{ p.country || "—" }}</td>
                <td>
                  <span class="badge badge-primary badge-sm">
                    {{ p.majorDivision }}
                  </span>
                </td>
                <td>
                  <div
                    v-if="p.minorDivisionTags.length > 0"
                    class="flex flex-wrap gap-1"
                  >
                    <span
                      v-for="tag in p.minorDivisionTags"
                      :key="tag"
                      class="badge badge-secondary badge-xs"
                    >
                      {{ tag }}
                    </span>
                  </div>
                  <span
                    v-else
                    class="text-xs opacity-50"
                  >—</span>
                </td>
                <td>
                  <div class="flex flex-wrap gap-1">
                    <span
                      v-for="disc in p.activeDisciplines"
                      :key="disc"
                      class="badge badge-outline badge-xs"
                    >
                      {{ getDisciplineLabel(disc) }}
                    </span>
                    <span
                      v-if="p.activeDisciplines.length === 0"
                      class="text-xs opacity-50 italic"
                    >
                      None active
                    </span>
                  </div>
                </td>
                <td>
                  <span
                    class="badge badge-xs"
                    :class="p.overallStatus === 'registered' ? 'badge-success' : 'badge-ghost'"
                  >
                    {{ p.overallStatus === "registered" ? "Registered" : "Withdrawn" }}
                  </span>
                </td>
                <td class="text-right">
                  <div class="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      class="btn btn-xs btn-ghost"
                      :disabled="entriesSaving"
                      @click="startEditingPlayer(p)"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      class="btn btn-xs"
                      :class="p.overallStatus === 'registered' ? 'btn-error btn-outline' : 'btn-success btn-outline'"
                      :disabled="entriesSaving"
                      @click="togglePlayerWithdrawal(p)"
                    >
                      {{ p.overallStatus === "registered" ? "Withdraw" : "Restore" }}
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="filteredPlayers.length === 0">
                <td
                  colspan="8"
                  class="text-center text-sm opacity-70 py-6"
                >
                  No registered players match the current filter.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Registration Lock Card -->
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
          Public self-registration open: <strong>{{ registrationLock.isRegistrationOpen ? "Yes" : `No (${registrationLock.registrationStatusReason || "closed"})` }}</strong>
          · Tournament started: <strong>{{ registrationLock.hasStarted ? "Yes" : "No" }}</strong>
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

    <!-- Tournament Player Numbers Card -->
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
