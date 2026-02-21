<script setup lang="ts">
import { useTournamentStore } from "~/stores/tournament";

definePageMeta({
  ssr: false,
});

const tournamentStore = useTournamentStore();

const filter = ref<"all" | "active" | "future" | "past">("all");
const sortBy = ref<"date" | "name" | "country" | "city">("date");
const sortDirection = ref<"asc" | "desc">("desc");

const filteredTournaments = computed(() => tournamentStore.filteredTournaments(filter.value, sortBy.value, sortDirection.value));

function toggleSortDirection() {
  sortDirection.value = sortDirection.value === "asc" ? "desc" : "asc";
}

onMounted(async () => {
  // Only load if not already loaded (plugin may have already loaded on app init)
  if (tournamentStore.tournaments.length === 0 && !tournamentStore.loading) {
    await tournamentStore.loadTournaments();
  }
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
      <div
        v-if="tournamentStore.loading"
        class="flex justify-center items-center py-12"
      >
        <span class="loading loading-spinner loading-lg" />
      </div>

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
              <div class="form-control">
                <label class="label">
                  <span class="label-text text-sm">Sort by</span>
                </label>
                <select
                  v-model="sortBy"
                  class="select select-bordered select-sm"
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
              </div>
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
        <div
          v-if="filteredTournaments.length === 0"
          class="alert alert-info"
        >
          <Icon
            name="tabler:info-circle"
            size="24"
          />
          <span>No tournaments found for this filter.</span>
        </div>

        <div
          v-else
          class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
        >
          <div
            v-for="tournament in filteredTournaments"
            :key="tournament.tournamentId"
            class="card bg-base-100 border border-base-300 shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer hover:scale-105"
            :class="{
              'ring-2 ring-primary ring-offset-2 ring-offset-base-100': tournament.tournamentId === tournamentStore.activeTournament?.tournamentId,
            }"
            @click="tournamentStore.selectTournament(tournament)"
          >
            <div class="card-body p-5">
              <div class="flex items-start justify-between gap-2 mb-2">
                <h3 class="card-title text-lg flex-1">
                  {{ tournament.tournamentName }}
                </h3>
                <span
                  v-if="tournament.isActive"
                  class="badge badge-success badge-sm gap-1 shrink-0"
                >
                  <span class="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                  Live
                </span>
              </div>

              <p
                v-if="tournament.tournamentDescription"
                class="text-sm opacity-70 line-clamp-2 mb-3"
              >
                {{ tournament.tournamentDescription }}
              </p>

              <div class="flex items-center gap-2 mb-3">
                <span
                  class="badge badge-sm font-medium"
                  :class="{
                    'badge-primary': tournament.role === 'owner',
                    'badge-secondary': tournament.role === 'admin',
                    'badge-accent': tournament.role === 'td',
                    'badge-info': tournament.role === 'scorer',
                    'badge-ghost': tournament.role === 'viewer',
                  }"
                >{{ tournament.role }}</span>
                <span class="badge badge-outline badge-sm">{{ tournament.tournamentStatus }}</span>
              </div>

              <div class="text-xs opacity-70 space-y-1.5 mb-3">
                <div
                  v-if="tournament.startDate && tournament.endDate"
                  class="flex items-center gap-1.5"
                >
                  <Icon
                    name="tabler:calendar"
                    size="14"
                  />
                  <span>
                    {{ new Date(tournament.startDate).toLocaleDateString() }} -
                    {{ new Date(tournament.endDate).toLocaleDateString() }}
                  </span>
                </div>
                <div
                  v-if="tournament.city || tournament.country"
                  class="flex items-center gap-1.5"
                >
                  <Icon
                    name="tabler:map-pin"
                    size="14"
                  />
                  <span>{{ [tournament.city, tournament.country].filter(Boolean).join(", ") }}</span>
                </div>
              </div>

              <!-- Event Types -->
              <div
                v-if="tournament.hasGolf || tournament.hasAccuracy || tournament.hasDistance || tournament.hasSCF || tournament.hasDiscathon || tournament.hasDDC || tournament.hasFreestyle"
                class="flex flex-wrap gap-1.5 pt-3 border-t border-base-300"
              >
                <EventTypeBadge v-if="tournament.hasGolf" type="golf" />
                <EventTypeBadge v-if="tournament.hasAccuracy" type="accuracy" />
                <EventTypeBadge v-if="tournament.hasDistance" type="distance" />
                <EventTypeBadge v-if="tournament.hasSCF" type="scf" />
                <EventTypeBadge v-if="tournament.hasDiscathon" type="discathon" />
                <EventTypeBadge v-if="tournament.hasDDC" type="ddc" />
                <EventTypeBadge v-if="tournament.hasFreestyle" type="freestyle" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </ClientOnly>
  </div>
</template>
