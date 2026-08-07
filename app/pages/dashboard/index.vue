<script setup lang="ts">
import type { VerticalTabConfig } from "~/components/vertical-tabs-layout.vue";
import { useAuthStore } from "~/stores/auth";
import { useTournamentStore } from "~/stores/tournament";

definePageMeta({
  ssr: false,
});

const tournamentStore = useTournamentStore();
const authStore = useAuthStore();
const route = useRoute();
const router = useRouter();

const socialConnectionMessage = ref<string | null>(null);
const providerFeedback = ref<{ type: "success" | "error"; message: string } | null>(null);
const passwordModalFeedback = ref<{ type: "success" | "error"; message: string } | null>(null);
const linkedProviders = ref<Array<{ providerId: string; label: string; icon: string; linked: boolean; canUnlink: boolean; accountId: string | null }>>([]);
const providerActionLoading = ref<string | null>(null);
const passwordModalOpen = ref(false);
const passwordMode = ref<"set" | "change">("change");
const currentPassword = ref("");
const newPassword = ref("");
const confirmPassword = ref("");
const revokeOtherSessions = ref(false);
const showCurrentPassword = ref(false);
const showNewPassword = ref(false);
const showConfirmPassword = ref(false);

type SupportedSocialProvider = "github" | "google" | "facebook";

const filter = ref<"all" | "active" | "future" | "past">("all");
const sortBy = ref<"date" | "name" | "country" | "city">("date");
const sortDirection = ref<"asc" | "desc">("desc");
const activeDashboardTab = ref("overview");

const dashboardTabs: VerticalTabConfig[] = [
  {
    id: "overview",
    label: "Overview",
    description: "Your dashboard summary",
  },
  {
    id: "accounts",
    label: "Connected accounts",
    description: "Manage linked sign-in methods",
  },
  {
    id: "tournaments",
    label: "My tournaments",
    description: "Browse and manage your tournaments",
  },
];

const filteredTournaments = computed(() => tournamentStore.filteredTournaments(filter.value, sortBy.value, sortDirection.value));

function toggleSortDirection() {
  sortDirection.value = sortDirection.value === "asc" ? "desc" : "asc";
}

function resolveSocialProviderLabel(rawProvider: string) {
  const provider = rawProvider.toLowerCase();
  if (provider === "github") {
    return "GitHub";
  }
  if (provider === "google") {
    return "Google";
  }
  if (provider === "facebook") {
    return "Facebook";
  }
  return "";
}

function dismissSocialConnectionMessage() {
  socialConnectionMessage.value = null;
}

function dismissProviderFeedback() {
  providerFeedback.value = null;
}

function setSocialConnectionMessage(message: string) {
  socialConnectionMessage.value = message;
}

function setProviderFeedback(type: "success" | "error", message: string) {
  providerFeedback.value = { type, message };
}

const passwordStrength = computed(() => {
  const value = newPassword.value;
  if (!value) {
    return {
      label: "Enter a new password with at least 8 characters.",
      toneClass: "text-base-content/60",
      progressClass: "progress-neutral",
      value: 0,
    };
  }

  let score = 0;
  if (value.length >= 8) {
    score += 1;
  }
  if (value.length >= 12) {
    score += 1;
  }
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) {
    score += 1;
  }
  if (/\d/.test(value)) {
    score += 1;
  }
  if (/[^A-Z0-9]/i.test(value)) {
    score += 1;
  }

  if (score <= 2) {
    return {
      label: "Weak password. Add length, numbers, and symbols.",
      toneClass: "text-error",
      progressClass: "progress-error",
      value: 25,
    };
  }

  if (score <= 4) {
    return {
      label: "Good password. A bit more length or complexity would strengthen it.",
      toneClass: "text-warning",
      progressClass: "progress-warning",
      value: 65,
    };
  }

  return {
    label: "Strong password.",
    toneClass: "text-success",
    progressClass: "progress-success",
    value: 100,
  };
});

function getUnlinkHelpText(provider: { providerId: string; linked: boolean; canUnlink: boolean }) {
  if (!provider.linked || provider.canUnlink || provider.providerId === "credential") {
    return "";
  }

  return "Keep at least one sign-in method: set a password or connect another provider first.";
}

function resetPasswordForm() {
  currentPassword.value = "";
  newPassword.value = "";
  confirmPassword.value = "";
  revokeOtherSessions.value = false;
  showCurrentPassword.value = false;
  showNewPassword.value = false;
  showConfirmPassword.value = false;
  passwordModalFeedback.value = null;
}

function openPasswordModal(provider: { linked: boolean }) {
  passwordMode.value = provider.linked ? "change" : "set";
  passwordModalFeedback.value = null;
  passwordModalOpen.value = true;
}

function closePasswordModal() {
  passwordModalOpen.value = false;
  resetPasswordForm();
}

async function submitPasswordChange(provider: { linked: boolean }) {
  passwordModalFeedback.value = null;

  if (provider.linked && !currentPassword.value) {
    passwordModalFeedback.value = { type: "error", message: "Enter your current password." };
    return;
  }

  if (!newPassword.value || !confirmPassword.value) {
    passwordModalFeedback.value = { type: "error", message: "Enter and confirm your new password." };
    return;
  }

  if (newPassword.value !== confirmPassword.value) {
    passwordModalFeedback.value = { type: "error", message: "Passwords do not match." };
    return;
  }

  if (newPassword.value.length < 8) {
    passwordModalFeedback.value = { type: "error", message: "Password must be at least 8 characters." };
    return;
  }

  providerActionLoading.value = "credential-password";

  try {
    const response = await $fetch<{ message?: string }>("/api/auth/change-password", {
      method: "POST",
      body: {
        currentPassword: provider.linked ? currentPassword.value : undefined,
        newPassword: newPassword.value,
        revokeOtherSessions: provider.linked ? revokeOtherSessions.value : undefined,
      },
    });

    await loadLinkedProviders();
    setProviderFeedback(
      "success",
      response.message || (provider.linked ? "Password updated successfully." : "Password added successfully."),
    );
    closePasswordModal();
  }
  catch (error: any) {
    const message = error?.data?.message || "Unable to update password right now.";
    passwordModalFeedback.value = { type: "error", message };
  }
  finally {
    providerActionLoading.value = null;
  }
}

async function loadLinkedProviders() {
  try {
    linkedProviders.value = await $fetch<Array<{ providerId: string; label: string; icon: string; linked: boolean; canUnlink: boolean; accountId: string | null }>>("/api/account/linked-providers");
  }
  catch (error: any) {
    console.error("Unable to load linked providers", error);
    setProviderFeedback("error", error?.data?.message || "Unable to load connected accounts right now.");
  }
}

function waitForNextPaint() {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        resolve();
      });
    });
  });
}

function waitForMinimumDuration(startedAt: number, minimumMs: number) {
  const elapsed = performance.now() - startedAt;
  const remaining = minimumMs - elapsed;

  if (remaining <= 0) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    window.setTimeout(() => {
      resolve();
    }, remaining);
  });
}

async function connectProvider(providerId: SupportedSocialProvider) {
  const loadingStartedAt = performance.now();
  providerActionLoading.value = providerId;
  await nextTick();
  await waitForNextPaint();

  try {
    const response = await $fetch<{ url: string; redirect: boolean; status?: boolean }>("/api/auth/link-social", {
      method: "POST",
      body: {
        provider: providerId,
        callbackURL: `/dashboard?socialConnected=${encodeURIComponent(providerId)}`,
      },
    });

    if (response.redirect && response.url) {
      await waitForMinimumDuration(loadingStartedAt, 450);
      window.location.assign(response.url);
      return;
    }

    await loadLinkedProviders();
    setProviderFeedback("success", `Connected ${resolveSocialProviderLabel(providerId)}.`);
  }
  catch (error: any) {
    const message = error?.data?.message || "Unable to connect that provider right now.";
    setProviderFeedback("error", message);
  }
  finally {
    providerActionLoading.value = null;
  }
}

async function unlinkProvider(provider: { providerId: string; label: string; accountId: string | null; linked: boolean; canUnlink: boolean }) {
  if (!provider.linked || !provider.canUnlink) {
    return;
  }

  providerActionLoading.value = provider.providerId;

  try {
    await $fetch("/api/auth/unlink-account", {
      method: "POST",
      body: {
        providerId: provider.providerId,
        accountId: provider.accountId ?? undefined,
      },
    });

    await loadLinkedProviders();
    setProviderFeedback("success", `${provider.label} has been disconnected.`);
  }
  catch (error: any) {
    const message = error?.data?.message || `Unable to disconnect ${provider.label} right now.`;
    setProviderFeedback("error", message);
  }
  finally {
    providerActionLoading.value = null;
  }
}

async function maybeShowSocialConnectionMessage() {
  if (!import.meta.client) {
    return;
  }

  const rawValue = route.query.socialConnected;
  const provider = typeof rawValue === "string"
    ? rawValue
    : Array.isArray(rawValue)
      ? (rawValue[0] || "")
      : "";

  const providerLabel = resolveSocialProviderLabel(provider);
  if (!providerLabel) {
    return;
  }

  // Keep this one-time per provider and user in the current browser.
  const userId = typeof authStore.currentUser?.id === "string" && authStore.currentUser.id.length > 0
    ? authStore.currentUser.id
    : "current-user";
  const storageKey = `social-connected:${userId}:${providerLabel.toLowerCase()}`;

  if (!window.localStorage.getItem(storageKey)) {
    window.localStorage.setItem(storageKey, String(Date.now()));
    setSocialConnectionMessage(`Your account is now connected to ${providerLabel}.`);
  }

  const nextQuery = { ...route.query };
  delete nextQuery.socialConnected;
  await router.replace({ query: nextQuery });
}

async function openTournamentEdit(tournamentSlug: string) {
  if (!tournamentSlug) {
    return;
  }

  const target = `/dashboard/tournaments/${tournamentSlug}/edit`;

  try {
    await navigateTo(target);
  }
  catch {
    if (import.meta.client) {
      window.location.assign(target);
    }
  }
}

onMounted(async () => {
  // Only load if not already loaded (plugin may have already loaded on app init)
  if (tournamentStore.tournaments.length === 0 && !tournamentStore.loading) {
    await tournamentStore.loadTournaments();
  }

  await loadLinkedProviders();
  await maybeShowSocialConnectionMessage();
});
</script>

<template>
  <div class="container mx-auto p-4 max-w-7xl">
    <ClientOnly>
      <TournamentSelectorModal />

      <div class="mb-6">
        <h1 class="text-3xl font-bold mb-2">
          My dashboard
        </h1>
        <p
          v-if="tournamentStore.activeTournament"
          class="text-lg opacity-70"
        >
          Active Tournament: <span class="font-semibold">{{ tournamentStore.activeTournament.tournamentName }}</span>
          <span class="badge badge-primary ml-2">{{ tournamentStore.activeTournament.role }}</span>
        </p>
      </div>

      <VerticalTabsLayout
        v-model="activeDashboardTab"
        :tabs="dashboardTabs"
        :initial-open-tab-ids="['overview', 'accounts']"
        session-state-key="dashboard"
      >
        <template #overview>
          <div class="space-y-6">
            <FlashAlert
              :message="socialConnectionMessage"
              type="success"
              @dismiss="dismissSocialConnectionMessage"
            />

            <div
              v-if="!tournamentStore.loading && !tournamentStore.hasActiveTournaments"
              class="alert alert-warning"
            >
              <Icon
                name="tabler:alert-circle"
                size="24"
              />
              <span>No active tournaments at this time. Check back later or contact your tournament director.</span>
            </div>
          </div>
        </template>

        <template #accounts>
          <div class="space-y-5">
            <FlashAlert
              :message="providerFeedback?.message || null"
              :type="providerFeedback?.type || 'info'"
              @dismiss="dismissProviderFeedback"
            />

            <div class="grid gap-3 md:grid-cols-2">
              <div
                v-for="provider in linkedProviders"
                :key="provider.providerId"
                class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-base-300 p-4"
              >
                <div class="flex items-center gap-3">
                  <Icon
                    :name="provider.icon"
                    size="20"
                  />
                  <div>
                    <div class="font-medium">
                      {{ provider.label }}
                    </div>
                    <div
                      v-if="provider.providerId === 'credential' && authStore.currentUser?.email"
                      class="mt-1 text-sm text-base-content/70"
                    >
                      <span>{{ authStore.currentUser.email }}</span>
                    </div>
                    <div class="mt-1">
                      <div class="flex flex-wrap items-center gap-2">
                        <span
                          class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
                          :class="provider.linked ? 'bg-success/15 text-success' : 'bg-base-200 text-base-content/70'"
                        >
                          {{ provider.linked ? 'Connected' : 'Not connected' }}
                        </span>
                        <button
                          v-if="provider.providerId === 'credential'"
                          class="btn btn-outline btn-xs gap-1.5"
                          type="button"
                          :disabled="providerActionLoading === 'credential-password'"
                          @click="openPasswordModal(provider)"
                        >
                          <Icon
                            name="tabler:key"
                            class="size-3.5 shrink-0"
                          />
                          <span>{{ provider.linked ? 'Change password' : 'Set password' }}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="flex items-center gap-2">
                  <button
                    v-if="provider.providerId !== 'credential' && !provider.linked"
                    class="btn btn-sm btn-primary"
                    :disabled="providerActionLoading === provider.providerId"
                    @click="connectProvider(provider.providerId as SupportedSocialProvider)"
                  >
                    <span
                      v-if="providerActionLoading === provider.providerId"
                      class="loading loading-spinner loading-sm"
                    />
                    <span v-else>{{ provider.linked ? 'Reconnect' : 'Connect' }}</span>
                  </button>

                  <button
                    v-else-if="provider.linked && provider.canUnlink"
                    class="btn btn-sm btn-outline gap-2"
                    :disabled="providerActionLoading === provider.providerId"
                    @click="unlinkProvider(provider)"
                  >
                    <span
                      v-if="providerActionLoading === provider.providerId"
                      class="loading loading-spinner loading-sm"
                    />
                    <template v-else>
                      <Icon
                        name="tabler:link-off"
                        size="16"
                      />
                      <span>Disconnect</span>
                    </template>
                  </button>

                  <div
                    v-else-if="provider.linked && provider.providerId !== 'credential'"
                    class="flex items-center gap-2"
                  >
                    <span
                      class="tooltip tooltip-left hidden sm:inline-flex"
                      :data-tip="getUnlinkHelpText(provider)"
                    >
                      <button
                        class="btn btn-sm btn-outline gap-2"
                        type="button"
                        disabled
                      >
                        <Icon
                          name="tabler:link-off"
                          size="16"
                        />
                        <span>Disconnect</span>
                      </button>
                    </span>
                    <button
                      class="btn btn-sm btn-outline gap-2 sm:hidden"
                      type="button"
                      disabled
                    >
                      <Icon
                        name="tabler:link-off"
                        size="16"
                      />
                      <span>Disconnect</span>
                    </button>
                  </div>

                  <span
                    v-else-if="provider.linked"
                    class="badge badge-success"
                  >
                    Active
                  </span>
                </div>

                <p
                  v-if="provider.linked && provider.providerId !== 'credential' && !provider.canUnlink"
                  class="w-full text-right text-xs text-base-content/65 sm:hidden"
                >
                  {{ getUnlinkHelpText(provider) }}
                </p>
              </div>
            </div>
          </div>
        </template>

        <template #tournaments>
          <div class="space-y-6">
            <!-- Loading State -->
            <PageLoadingState v-if="tournamentStore.loading" />

            <div v-else>
              <div class="mb-6">
                <div class="flex flex-col sm:flex-row gap-4 items-start sm:items-end justify-between">
                  <!-- Filter Tabs -->
                  <div class="tabs tabs-boxed">
                    <button
                      class="tab"
                      :class="{ 'tab-active': filter === 'all' }"
                      @click="filter = 'all'"
                    >
                      All
                    </button>
                    <button
                      class="tab"
                      :class="{ 'tab-active': filter === 'active' }"
                      @click="filter = 'active'"
                    >
                      Active
                    </button>
                    <button
                      class="tab"
                      :class="{ 'tab-active': filter === 'future' }"
                      @click="filter = 'future'"
                    >
                      Future
                    </button>
                    <button
                      class="tab"
                      :class="{ 'tab-active': filter === 'past' }"
                      @click="filter = 'past'"
                    >
                      Past
                    </button>
                  </div>

                  <!-- Sort Dropdown -->
                  <div class="flex gap-2 items-end">
                    <FormField label="Sort by">
                      <select
                        v-model="sortBy"
                        class="select select-bordered select-sm bg-base-100 text-base-content border-base-300 hover:border-base-content/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        <option value="date">
                          Date
                        </option>
                        <option value="name">
                          Name
                        </option>
                        <option value="country">
                          Country
                        </option>
                        <option value="city">
                          City
                        </option>
                      </select>
                    </FormField>
                    <button
                      class="btn btn-sm btn-square"
                      :title="sortDirection === 'asc' ? 'Ascending' : 'Descending'"
                      @click="toggleSortDirection"
                    >
                      <Icon
                        :name="sortDirection === 'asc' ? 'tabler:sort-ascending' : 'tabler:sort-descending'"
                        size="20"
                      />
                    </button>
                  </div>
                </div>
              </div>

              <!-- Tournament Cards -->
              <EmptyStateAlert
                v-if="filteredTournaments.length === 0"
                message="No tournaments found for this filter."
              />

              <div
                v-else
                class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
              >
                <TournamentCard
                  v-for="tournament in filteredTournaments"
                  :key="tournament.tournamentId"
                  :title="tournament.tournamentName"
                  :description="tournament.tournamentDescription"
                  :date-text="tournament.startDate && tournament.endDate ? `${new Date(tournament.startDate).toLocaleDateString()} - ${new Date(tournament.endDate).toLocaleDateString()}` : ''"
                  :location-text="[tournament.city, tournament.country].filter(Boolean).join(', ')"
                  :is-active="tournament.isActive"
                  :show-status-badge="false"
                  card-class="cursor-pointer"
                  :class="{
                    'ring-2 ring-primary ring-offset-2 ring-offset-base-100': tournament.tournamentId === tournamentStore.activeTournament?.tournamentId,
                  }"
                  description-class="text-sm opacity-70 line-clamp-2 mb-3"
                  meta-class="text-xs opacity-70 space-y-1.5 mb-3"
                  :icon-size="14"
                  :has-golf="tournament.hasGolf ?? undefined"
                  :has-accuracy="tournament.hasAccuracy ?? undefined"
                  :has-distance="tournament.hasDistance ?? undefined"
                  :has-scf="tournament.hasSCF ?? undefined"
                  :has-discathon="tournament.hasDiscathon ?? undefined"
                  :has-ddc="tournament.hasDDC ?? undefined"
                  :has-freestyle="tournament.hasFreestyle ?? undefined"
                  @click="tournamentStore.selectTournament(tournament)"
                >
                  <template #title-right>
                    <span
                      v-if="tournament.isActive"
                      class="badge badge-success badge-sm gap-1 shrink-0 inline-flex items-center justify-center whitespace-nowrap align-middle"
                    >
                      <span class="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                      Live
                    </span>
                  </template>

                  <template #meta-top>
                    <div class="flex items-center gap-2 mb-3">
                      <span
                        class="badge badge-sm font-medium inline-flex items-center justify-center whitespace-nowrap align-middle"
                        :class="{
                          'badge-primary': tournament.role === 'owner',
                          'badge-secondary': tournament.role === 'admin',
                          'badge-accent': tournament.role === 'td',
                          'badge-info': tournament.role === 'scorer',
                          'badge-neutral': tournament.role === 'viewer',
                        }"
                      >{{ tournament.role }}</span>
                      <span class="badge badge-outline badge-sm font-medium inline-flex items-center justify-center whitespace-nowrap align-middle">{{ tournament.tournamentStatus }}</span>
                    </div>
                  </template>

                  <template #actions>
                    <TournamentActionsRow
                      justify="end"
                      margin-top="sm"
                    >
                      <button
                        v-if="tournament.canEdit"
                        type="button"
                        class="btn btn-xs btn-outline"
                        @click.stop.prevent="openTournamentEdit(tournament.tournamentSlug)"
                      >
                        Edit Tournament
                      </button>
                    </TournamentActionsRow>
                  </template>
                </TournamentCard>
              </div>
            </div>
          </div>
        </template>
      </VerticalTabsLayout>

      <ConfirmationModal
        :open="passwordModalOpen"
        :title="passwordMode === 'change' ? 'Change password' : 'Set password'"
        :message="passwordMode === 'change' ? 'Update your password for email sign-in.' : 'Add a password so you can also sign in with email.'"
        :confirm-text="passwordMode === 'change' ? 'Update password' : 'Save password'"
        :confirm-disabled="providerActionLoading === 'credential-password'"
        confirm-icon="tabler:key"
        :confirm-loading="providerActionLoading === 'credential-password'"
        @cancel="closePasswordModal"
        @confirm="submitPasswordChange({ linked: passwordMode === 'change' })"
      >
        <div class="-mt-1 space-y-3">
          <FlashAlert
            :message="passwordModalFeedback?.message || null"
            :type="passwordModalFeedback?.type || 'info'"
            :auto-hide-ms="0"
            @dismiss="passwordModalFeedback = null"
          />

          <div class="flex flex-col gap-3">
            <label
              v-if="passwordMode === 'change'"
              class="form-control gap-2"
            >
              <span class="label-text mb-2 text-sm">Current password</span>
              <div class="join w-full">
                <input
                  v-model="currentPassword"
                  :type="showCurrentPassword ? 'text' : 'password'"
                  autocomplete="current-password"
                  class="input input-bordered join-item w-full"
                  placeholder="Current password"
                >
                <button
                  class="btn btn-square join-item border border-base-300 bg-base-100 text-base-content/80 shadow-none hover:border-base-content/40 hover:bg-base-200 hover:text-base-content focus-visible:outline-none"
                  type="button"
                  :aria-label="showCurrentPassword ? 'Hide current password' : 'Show current password'"
                  @click="showCurrentPassword = !showCurrentPassword"
                >
                  <Icon
                    :name="showCurrentPassword ? 'tabler:eye-off' : 'tabler:eye'"
                    class="size-4 shrink-0"
                  />
                </button>
              </div>
            </label>

            <label class="form-control gap-2">
              <span class="label-text mb-2 text-sm">New password</span>
              <div class="join w-full">
                <input
                  v-model="newPassword"
                  :type="showNewPassword ? 'text' : 'password'"
                  autocomplete="new-password"
                  class="input input-bordered join-item w-full"
                  placeholder="At least 8 characters"
                >
                <button
                  class="btn btn-square join-item border border-base-300 bg-base-100 text-base-content/80 shadow-none hover:border-base-content/40 hover:bg-base-200 hover:text-base-content focus-visible:outline-none"
                  type="button"
                  :aria-label="showNewPassword ? 'Hide new password' : 'Show new password'"
                  @click="showNewPassword = !showNewPassword"
                >
                  <Icon
                    :name="showNewPassword ? 'tabler:eye-off' : 'tabler:eye'"
                    class="size-4 shrink-0"
                  />
                </button>
              </div>
            </label>

            <label class="form-control gap-2">
              <span class="label-text mb-2 text-sm">Confirm password</span>
              <div class="join w-full">
                <input
                  v-model="confirmPassword"
                  :type="showConfirmPassword ? 'text' : 'password'"
                  autocomplete="new-password"
                  class="input input-bordered join-item w-full"
                  placeholder="Confirm new password"
                  @keydown.enter="submitPasswordChange({ linked: passwordMode === 'change' })"
                >
                <button
                  class="btn btn-square join-item border border-base-300 bg-base-100 text-base-content/80 shadow-none hover:border-base-content/40 hover:bg-base-200 hover:text-base-content focus-visible:outline-none"
                  type="button"
                  :aria-label="showConfirmPassword ? 'Hide password confirmation' : 'Show password confirmation'"
                  @click="showConfirmPassword = !showConfirmPassword"
                >
                  <Icon
                    :name="showConfirmPassword ? 'tabler:eye-off' : 'tabler:eye'"
                    class="size-4 shrink-0"
                  />
                </button>
              </div>
            </label>
          </div>

          <div class="space-y-1">
            <progress
              class="progress m-0 h-2 w-full"
              :class="passwordStrength.progressClass"
              :value="passwordStrength.value"
              max="100"
            />
            <p
              class="text-sm"
              :class="passwordStrength.toneClass"
            >
              {{ passwordStrength.label }}
            </p>
          </div>

          <label
            v-if="passwordMode === 'change'"
            class="label cursor-pointer justify-start gap-3 rounded-md border border-base-300 px-3 py-2"
          >
            <input
              v-model="revokeOtherSessions"
              type="checkbox"
              class="checkbox checkbox-sm"
            >
            <span class="label-text">Sign out my other devices after changing password</span>
          </label>
        </div>
      </ConfirmationModal>
    </ClientOnly>
  </div>
</template>
