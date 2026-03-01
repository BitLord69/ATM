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

const editPermissions = ref<Record<number, boolean>>({});

// Load edit permissions for all tournaments when list changes
async function loadPermissions() {
  if (!tournaments.value) {
    return;
  }

  editPermissions.value = {};

  for (const tournament of tournaments.value) {
    try {
      const { data } = await useFetch(`/api/tournaments/${tournament.slug}/check-edit-permission`);
      if (data.value && typeof data.value === "object" && "canEdit" in data.value) {
        editPermissions.value[tournament.id] = (data.value as { canEdit: boolean }).canEdit;
      }
    }
    catch {
      editPermissions.value[tournament.id] = false;
    }
  }
}

watch(() => tournaments.value, () => {
  loadPermissions();
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
    <PageLoadingState v-if="pending" />

    <!-- Empty State -->
    <EmptyStateAlert
      v-else-if="!tournaments || tournaments.length === 0"
      message="No tournaments found for this filter."
    />

    <!-- Tournament Grid -->
    <div
      v-else
      class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
    >
      <TournamentCard
        v-for="tournament in tournaments"
        :key="tournament.id"
        :title="tournament.name"
        :description="tournament.description"
        :date-text="formatDateRange(tournament.startDate, tournament.endDate)"
        :location-text="[tournament.city, tournament.country].filter(Boolean).join(', ')"
        :is-active="tournament.isActive"
        :status="tournament.status"
        :has-golf="tournament.hasGolf"
        :has-accuracy="tournament.hasAccuracy"
        :has-distance="tournament.hasDistance"
        :has-scf="tournament.hasSCF"
        :has-discathon="tournament.hasDiscathon"
        :has-ddc="tournament.hasDDC"
        :has-freestyle="tournament.hasFreestyle"
      >
        <template #actions>
          <TournamentActionsRow>
            <NuxtLink
              :to="`/tournaments/${tournament.slug}`"
              class="btn btn-ghost btn-sm flex-1"
            >
              View Details
            </NuxtLink>
            <NuxtLink
              v-if="editPermissions[tournament.id]"
              :to="`/dashboard/tournaments/${tournament.slug}/edit`"
              class="btn btn-primary btn-sm gap-1"
            >
              <Icon
                name="tabler:edit"
                size="16"
              />
              Edit
            </NuxtLink>
          </TournamentActionsRow>
        </template>
      </TournamentCard>
    </div>
  </div>
</template>
