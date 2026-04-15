<script setup lang="ts">
import type { DisciplineKey } from "~/composables/use-discipline-catalog";

import { disciplineCatalog } from "~/composables/use-discipline-catalog";

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

// Discipline filtering
const activeDisciplines = ref<Set<DisciplineKey>>(new Set());

function toggleDiscipline(key: DisciplineKey) {
  if (activeDisciplines.value.has(key)) {
    activeDisciplines.value.delete(key);
  }
  else {
    activeDisciplines.value.add(key);
  }
  // trigger reactivity
  activeDisciplines.value = new Set(activeDisciplines.value);
}

const filteredTournaments = computed(() => {
  if (!tournaments.value)
    return [];
  if (activeDisciplines.value.size === 0)
    return tournaments.value;
  return tournaments.value.filter(t =>
    [...activeDisciplines.value].every(key => t[key]),
  );
});

const filteredCount = computed(() => filteredTournaments.value.length);

const { formatDateRange } = useFormatDate();
</script>

<template>
  <div class="container mx-auto p-4 max-w-7xl">
    <div class="mb-5">
      <h1 class="text-4xl font-bold mb-2">
        Tournaments
      </h1>
      <p class="text-lg opacity-70">
        Browse upcoming and active allround frisbee tournaments worldwide
      </p>
    </div>

    <!-- Filter Tabs + Discipline Filters -->
    <div class="mb-3 space-y-1">
      <div class="tabs self-start -ml-3">
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

      <div class="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
        <div class="flex flex-wrap gap-2 items-center">
          <span class="text-sm font-medium opacity-60 mr-1">Disciplines:</span>
          <button
            v-for="discipline in disciplineCatalog"
            :key="discipline.key"
            type="button"
            class="btn btn-sm gap-1.5 transition-all"
            :class="activeDisciplines.has(discipline.key)
              ? 'btn-primary'
              : 'btn-ghost border border-base-300'"
            @click="toggleDiscipline(discipline.key)"
          >
            <Icon :name="discipline.icon" size="15" />
            {{ discipline.label }}
          </button>
          <button
            v-if="activeDisciplines.size > 0"
            type="button"
            class="btn btn-sm btn-ghost opacity-60"
            @click="activeDisciplines = new Set()"
          >
            Clear
          </button>
        </div>

        <span class="text-sm opacity-50 md:text-right md:whitespace-nowrap">
          {{ filteredCount }} tournament{{ filteredCount !== 1 ? 's' : '' }} found
        </span>
      </div>
    </div>

    <!-- Loading State -->
    <PageLoadingState v-if="pending" />

    <!-- Empty State -->
    <EmptyStateAlert
      v-else-if="!filteredTournaments.length"
      :message="activeDisciplines.size > 0 ? 'No tournaments match the selected disciplines.' : 'No tournaments found for this filter.'"
    />

    <!-- Tournament Grid -->
    <div
      v-else
      class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
    >
      <TournamentCard
        v-for="tournament in filteredTournaments"
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
