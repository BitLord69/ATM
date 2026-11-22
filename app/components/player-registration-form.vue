<script setup lang="ts">
import type {
  DisciplineOption,
  MajorDivisionOption,
  TournamentPlayerGroup,
  UserSearchResult,
} from "~/types/tournament-registration";

const props = defineProps<{
  slug: string;
  majorDivisions: MajorDivisionOption[];
  enabledDisciplines: DisciplineOption[];
  editingPlayer: TournamentPlayerGroup | null;
}>();

const emit = defineEmits<{
  saved: [message: string];
  cancel: [];
}>();

const registerMode = ref<"existing" | "guest">("guest");
const selectedUser = ref<UserSearchResult | null>(null);

const userSearchQuery = ref("");
const userSearchResults = ref<UserSearchResult[]>([]);
const userSearchLoading = ref(false);
const userSearchError = ref<string | null>(null);
let userSearchTimer: ReturnType<typeof setTimeout> | null = null;
let userSearchRequestId = 0;

const formDisplayName = ref("");
const formCountry = ref("");
const formEmail = ref("");
const formDateOfBirth = ref("");
const formGenderCategory = ref<"open" | "women">("open");
const formPdgaNumber = ref("");
const formHomeClub = ref("");
const formMajorDivision = ref("OPEN");
const formSelectedDisciplines = ref<string[]>([]);

const saving = ref(false);
const errorMessage = ref<string | null>(null);

const isEditing = computed(() => !!props.editingPlayer);
// New registrations of existing users take profile data from their account
const showProfileFields = computed(() => isEditing.value || registerMode.value === "guest");

const isFullOverall = computed(() =>
  props.enabledDisciplines.length > 0
  && props.enabledDisciplines.every(d => formSelectedDisciplines.value.includes(d.key)),
);

function resetForm() {
  const p = props.editingPlayer;
  errorMessage.value = null;
  selectedUser.value = null;
  userSearchQuery.value = "";
  userSearchResults.value = [];

  registerMode.value = p ? (p.isGuest ? "guest" : "existing") : "guest";
  formDisplayName.value = p?.displayName || "";
  formCountry.value = p?.country || "";
  formEmail.value = p?.email || "";
  formDateOfBirth.value = p?.dateOfBirth || "";
  formGenderCategory.value = p?.genderCategory === "women" ? "women" : "open";
  formPdgaNumber.value = p?.pdgaNumber || "";
  formHomeClub.value = p?.homeClub || "";
  formMajorDivision.value = p?.majorDivision || props.majorDivisions[0]?.code || "OPEN";
  formSelectedDisciplines.value = p?.activeDisciplines.length
    ? [...p.activeDisciplines]
    : props.enabledDisciplines.map(d => d.key);
}

watch(() => props.editingPlayer, resetForm, { immediate: true });

function selectAllDisciplines() {
  formSelectedDisciplines.value = props.enabledDisciplines.map(d => d.key);
}

async function runUserSearch(query: string) {
  const requestId = ++userSearchRequestId;
  userSearchLoading.value = true;
  userSearchError.value = null;
  try {
    const result = await $fetch<{ users: UserSearchResult[] }>(`/api/tournaments/${props.slug}/user-search`, {
      query: { q: query },
    });
    if (requestId === userSearchRequestId) {
      userSearchResults.value = result.users;
    }
  }
  catch (error) {
    if (requestId === userSearchRequestId) {
      userSearchError.value = getApiErrorMessage(error, "User search failed.");
    }
  }
  finally {
    if (requestId === userSearchRequestId) {
      userSearchLoading.value = false;
    }
  }
}

watch(userSearchQuery, (value) => {
  if (userSearchTimer) {
    clearTimeout(userSearchTimer);
  }
  const query = value.trim();
  if (query.length < 2) {
    userSearchRequestId++;
    userSearchResults.value = [];
    userSearchLoading.value = false;
    return;
  }
  userSearchTimer = setTimeout(runUserSearch, 300, query);
});

onBeforeUnmount(() => {
  if (userSearchTimer) {
    clearTimeout(userSearchTimer);
  }
});

function chooseUser(user: UserSearchResult) {
  selectedUser.value = user;
  errorMessage.value = null;
}

function buildProfilePayload() {
  return {
    displayName: formDisplayName.value.trim() || undefined,
    country: formCountry.value.trim() || null,
    email: formEmail.value.trim() || null,
    dateOfBirth: formDateOfBirth.value.trim() || null,
    genderCategory: formGenderCategory.value,
    pdgaNumber: formPdgaNumber.value.trim() || null,
    homeClub: formHomeClub.value.trim() || null,
  };
}

async function submit() {
  if (saving.value) {
    return;
  }
  errorMessage.value = null;

  if (formSelectedDisciplines.value.length === 0) {
    errorMessage.value = "Please select at least one discipline.";
    return;
  }

  saving.value = true;
  try {
    if (props.editingPlayer) {
      await $fetch(`/api/tournaments/${props.slug}/entries/${props.editingPlayer.playerId}`, {
        method: "PATCH",
        body: {
          majorDivision: formMajorDivision.value,
          disciplines: formSelectedDisciplines.value,
          status: "registered",
          profile: buildProfilePayload(),
        },
      });
      emit("saved", `Updated registration for ${formDisplayName.value || "player"}.`);
    }
    else if (registerMode.value === "existing") {
      if (!selectedUser.value) {
        errorMessage.value = "Search for and select an existing user account.";
        return;
      }
      await $fetch(`/api/tournaments/${props.slug}/entries`, {
        method: "POST",
        body: {
          userId: selectedUser.value.id,
          majorDivision: formMajorDivision.value,
          disciplines: formSelectedDisciplines.value,
        },
      });
      emit("saved", `Registered ${selectedUser.value.name}.`);
    }
    else {
      const displayName = formDisplayName.value.trim();
      if (!displayName) {
        errorMessage.value = "Guest player display name is required.";
        return;
      }
      await $fetch(`/api/tournaments/${props.slug}/entries`, {
        method: "POST",
        body: {
          majorDivision: formMajorDivision.value,
          disciplines: formSelectedDisciplines.value,
          guestPlayer: { ...buildProfilePayload(), displayName },
        },
      });
      emit("saved", `Registered guest player ${displayName}.`);
    }
  }
  catch (error) {
    errorMessage.value = getApiErrorMessage(error, "Failed to save player registration.");
  }
  finally {
    saving.value = false;
  }
}
</script>

<template>
  <form
    aria-labelledby="td-register-player-heading"
    class="bg-base-100 border border-base-300 rounded-box p-4 space-y-4"
    @submit.prevent="submit"
  >
    <div class="flex items-center justify-between gap-2">
      <h3
        id="td-register-player-heading"
        class="font-semibold text-base"
      >
        {{ editingPlayer ? `Edit Registration: ${editingPlayer.displayName}` : "Register Player into Tournament" }}
      </h3>
      <button
        type="button"
        class="btn btn-xs btn-ghost"
        @click="emit('cancel')"
      >
        Cancel
      </button>
    </div>

    <div
      v-if="errorMessage"
      role="alert"
      aria-live="polite"
      class="alert alert-error py-2"
    >
      <span class="text-sm">{{ errorMessage }}</span>
    </div>

    <!-- Player type (new registrations only) -->
    <fieldset
      v-if="!isEditing"
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
          New Guest / Offline Player (no login account required)
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

    <!-- Existing user search -->
    <div
      v-if="!isEditing && registerMode === 'existing'"
      class="space-y-2"
    >
      <search class="flex flex-col gap-1">
        <label
          for="td-user-search"
          class="text-sm font-medium"
        >
          Search user by name or email <span aria-hidden="true">*</span>
        </label>
        <input
          id="td-user-search"
          v-model="userSearchQuery"
          type="search"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="none"
          spellcheck="false"
          aria-describedby="td-user-search-hint"
          placeholder="Type at least 2 characters..."
          class="input input-bordered input-sm w-full"
        >
        <span
          id="td-user-search-hint"
          class="text-xs opacity-60"
        >
          Shows up to 20 matching accounts. Profile details are taken from the selected account.
        </span>
      </search>

      <p
        v-if="userSearchError"
        role="alert"
        class="text-xs text-error"
      >
        {{ userSearchError }}
      </p>

      <div
        v-if="selectedUser"
        role="status"
        class="flex items-center justify-between gap-2 bg-base-200 rounded-lg px-3 py-2 text-sm"
      >
        <span>
          Selected: <strong>{{ selectedUser.name }}</strong> ({{ selectedUser.email }}){{ selectedUser.country ? ` · ${selectedUser.country}` : "" }}
        </span>
        <button
          type="button"
          class="btn btn-xs btn-ghost"
          @click="selectedUser = null"
        >
          Change
        </button>
      </div>

      <ul
        v-else-if="userSearchResults.length > 0"
        class="menu bg-base-200 rounded-box max-h-60 overflow-y-auto w-full"
        aria-label="Matching users"
      >
        <li
          v-for="u in userSearchResults"
          :key="u.id"
        >
          <button
            type="button"
            @click="chooseUser(u)"
          >
            <span class="font-medium">{{ u.name }}</span>
            <span class="text-xs opacity-70">{{ u.email }}{{ u.country ? ` · ${u.country}` : "" }}</span>
          </button>
        </li>
      </ul>

      <p
        v-else-if="userSearchLoading"
        class="text-xs opacity-70 flex items-center gap-2"
      >
        <span class="loading loading-spinner loading-xs" /> Searching...
      </p>

      <p
        v-else-if="userSearchQuery.trim().length >= 2"
        class="text-xs opacity-70"
      >
        No matching users found.
      </p>
    </div>

    <!-- Player profile fields -->
    <fieldset
      v-if="showProfileFields"
      class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 border border-base-300 rounded-lg p-3"
    >
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
            v-for="div in majorDivisions"
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
            :class="isFullOverall ? 'btn-secondary' : 'btn-outline'"
            @click="selectAllDisciplines"
          >
            Select All / Full Overall
          </button>
        </div>
        <div class="flex flex-wrap gap-3 pt-1">
          <div
            v-for="disc in enabledDisciplines"
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
        @click="emit('cancel')"
      >
        Cancel
      </button>
      <button
        type="submit"
        class="btn btn-sm btn-primary"
        :disabled="saving"
      >
        <span
          v-if="saving"
          class="loading loading-spinner loading-xs"
        />
        {{ editingPlayer ? "Save Changes" : "Register Player" }}
      </button>
    </div>
  </form>
</template>
