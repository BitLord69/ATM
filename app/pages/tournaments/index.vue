<script setup lang="ts">
/**
 * Public tournament list page
 * Accessible to everyone including guests
 */

const filter = ref<"upcoming" | "active" | "finished" | "all">("upcoming");
const { data: tournaments, pending } = await useFetch("/api/tournaments/public", {
  query: { filter },
  watch: [filter],
});

const filteredCount = computed(() => tournaments.value?.length || 0);

function formatDate(timestamp: number | null | undefined) {
  if (!timestamp)
    return "TBD";
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateRange(start: number | null | undefined, end: number | null | undefined) {
  if (!start || !end)
    return "Dates TBD";
  const startDate = new Date(start);
  const endDate = new Date(end);

  if (startDate.toDateString() === endDate.toDateString()) {
    return formatDate(start);
  }

  return `${formatDate(start)} - ${formatDate(end)}`;
}
</script>

<template>
  <div class="container mx-auto p-4 max-w-7xl">
    <div class="mb-8">
      <h1 class="text-4xl font-bold mb-2">
        Tournaments
      </h1>
      <p class="text-lg opacity-70">
        Browse upcoming and active allround frisbee tournaments worldwide
      </p>
    </div>

    <!-- Filter Tabs -->
    <div class="mb-6">
      <div class="tabs tabs-boxed">
        <button
          class="tab"
          :class="{ 'tab-active': filter === 'upcoming' }"
          @click="filter = 'upcoming'"
        >
          Upcoming
        </button>
        <button
          class="tab"
          :class="{ 'tab-active': filter === 'active' }"
          @click="filter = 'active'"
        >
          Active Now
        </button>
        <button
          class="tab"
          :class="{ 'tab-active': filter === 'finished' }"
          @click="filter = 'finished'"
        >
          Finished
        </button>
        <button
          class="tab"
          :class="{ 'tab-active': filter === 'all' }"
          @click="filter = 'all'"
        >
          All Tournaments
        </button>
      </div>
      <div class="text-sm opacity-70 mt-2">
        {{ filteredCount }} tournament{{ filteredCount !== 1 ? 's' : '' }} found
      </div>
    </div>

    <!-- Loading State -->
    <div
      v-if="pending"
      class="flex justify-center items-center py-12"
    >
      <span class="loading loading-spinner loading-lg" />
    </div>

    <!-- Empty State -->
    <div
      v-else-if="!tournaments || tournaments.length === 0"
      class="alert alert-info"
    >
      <Icon
        name="tabler:info-circle"
        size="24"
      />
      <span>No tournaments found for this filter.</span>
    </div>

    <!-- Tournament Grid -->
    <div
      v-else
      class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
    >
      <NuxtLink
        v-for="tournament in tournaments"
        :key="tournament.id"
        :to="`/tournaments/${tournament.slug}`"
        class="card bg-base-100 border border-base-300 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
      >
        <div class="card-body p-5">
          <div class="flex items-start justify-between gap-2 mb-2">
            <h3 class="card-title text-lg flex-1">
              {{ tournament.name }}
            </h3>
            <span
              v-if="tournament.isActive"
              class="badge badge-success badge-sm gap-1 shrink-0"
            >
              <span class="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
              Live
            </span>
            <span
              v-else-if="tournament.status === 'future'"
              class="badge badge-info badge-sm shrink-0"
            >
              Upcoming
            </span>
            <span
              v-else
              class="badge badge-ghost badge-sm shrink-0"
            >
              Past
            </span>
          </div>

          <p
            v-if="tournament.description"
            class="text-base opacity-70 line-clamp-2 mb-3"
          >
            {{ tournament.description }}
          </p>

          <div class="text-sm opacity-70 space-y-1.5 mb-3">
            <div class="flex items-center gap-1.5">
              <Icon
                name="tabler:calendar"
                size="16"
              />
              <span>{{ formatDateRange(tournament.startDate, tournament.endDate) }}</span>
            </div>
            <div
              v-if="tournament.city || tournament.country"
              class="flex items-center gap-1.5"
            >
              <Icon
                name="tabler:map-pin"
                size="16"
              />
              <span>{{ [tournament.city, tournament.country].filter(Boolean).join(", ") }}</span>
            </div>
          </div>

          <!-- Event Types -->
          <div
            v-if="tournament.hasGolf || tournament.hasAccuracy || tournament.hasDistance || tournament.hasSCF || tournament.hasDiscathon || tournament.hasDDC || tournament.hasFreestyle"
            class="flex flex-wrap gap-1.5 pt-3 border-t border-base-300"
          >
            <EventTypeBadge
              v-if="tournament.hasGolf"
              type="golf"
              size="md"
            />
            <EventTypeBadge
              v-if="tournament.hasAccuracy"
              type="accuracy"
              size="md"
            />
            <EventTypeBadge
              v-if="tournament.hasDistance"
              type="distance"
              size="md"
            />
            <EventTypeBadge
              v-if="tournament.hasSCF"
              type="scf"
              size="md"
            />
            <EventTypeBadge
              v-if="tournament.hasDiscathon"
              type="discathon"
              size="md"
            />
            <EventTypeBadge
              v-if="tournament.hasDDC"
              type="ddc"
              size="md"
            />
            <EventTypeBadge
              v-if="tournament.hasFreestyle"
              type="freestyle"
              size="md"
            />
          </div>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>
