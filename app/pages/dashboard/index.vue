<script setup lang="ts">
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

const filter = ref<"all" | "active" | "future" | "past">("all");
const sortBy = ref<"date" | "name" | "country" | "city">("date");
const sortDirection = ref<"asc" | "desc">("desc");

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
    socialConnectionMessage.value = `Your account is now connected to ${providerLabel}.`;
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

  await maybeShowSocialConnectionMessage();
});
</script>

<template>
  <div class="container mx-auto p-4 max-w-7xl">
    <ClientOnly>
      <TournamentSelectorModal />

      <div class="mb-6">
        <h1 class="text-3xl font-bold mb-2">
          Dashboard
        </h1>
        <p
          v-if="tournamentStore.activeTournament"
          class="text-lg opacity-70"
        >
          Active Tournament: <span class="font-semibold">{{ tournamentStore.activeTournament.tournamentName }}</span>
          <span class="badge badge-primary ml-2">{{ tournamentStore.activeTournament.role }}</span>
        </p>
      </div>

      <div
        v-if="socialConnectionMessage"
        role="status"
        class="alert alert-success mb-6"
      >
        <Icon
          name="tabler:circle-check"
          size="24"
        />
        <span>{{ socialConnectionMessage }}</span>
      </div>

      <!-- TODO: On the future user home/profile page, add a persistent social-connection badge and a button to disconnect linked social login providers. -->

      <!-- No Active Tournaments Message -->
      <div
        v-if="!tournamentStore.loading && !tournamentStore.hasActiveTournaments"
        class="alert alert-warning mb-6"
      >
        <Icon
          name="tabler:alert-circle"
          size="24"
        />
        <span>No active tournaments at this time. Check back later or contact your tournament director.</span>
      </div>

      <!-- Loading State -->
      <PageLoadingState v-if="tournamentStore.loading" />

      <!-- Tournament List -->
      <div v-else>
        <div class="mb-6">
          <h2 class="text-2xl font-semibold mb-4">
            My Tournaments
          </h2>

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
    </ClientOnly>
  </div>
</template>
