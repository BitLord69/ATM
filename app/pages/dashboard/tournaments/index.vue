<script setup lang="ts">
import { useTournamentStore } from "~/stores/tournament";

definePageMeta({
  ssr: false,
});

const tournamentStore = useTournamentStore();
const authStore = useAuthStore();

const TOURNAMENT_ADMIN_ROLES = new Set(["owner", "admin", "td"]);

const searchQuery = ref("");
const statusFilter = ref<"all" | "active" | "future" | "past">("all");

const isGlobalAdmin = computed(() => authStore.currentUser?.role === "admin");

const editableTournaments = computed(() => {
  return tournamentStore.tournaments.filter((tournament) => {
    if (isGlobalAdmin.value) {
      return true;
    }

    return tournament.status === "active" && TOURNAMENT_ADMIN_ROLES.has(tournament.role);
  });
});

const filteredTournaments = computed(() => {
  const normalizedQuery = searchQuery.value.trim().toLowerCase();

  return editableTournaments.value
    .filter((tournament) => {
      if (statusFilter.value !== "all" && tournament.tournamentStatus !== statusFilter.value) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const haystack = [
        tournament.tournamentName,
        tournament.tournamentSlug,
        tournament.city || "",
        tournament.country || "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    })
    .sort((left, right) => {
      const leftDate = left.startDate || 0;
      const rightDate = right.startDate || 0;
      return rightDate - leftDate;
    });
});

const { formatDateRange } = useFormatDate();

onMounted(async () => {
  if (tournamentStore.tournaments.length === 0 && !tournamentStore.loading) {
    await tournamentStore.loadTournaments();
  }
});
</script>

<template>
  <div class="container mx-auto max-w-7xl p-4 md:p-6">
    <div class="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 class="text-2xl md:text-3xl font-bold">
          Tournament Workspace
        </h1>
        <p class="opacity-70">
          Select a tournament to open its admin workspace.
        </p>
      </div>
      <NuxtLink to="/dashboard" class="btn btn-ghost btn-sm self-start md:self-auto">
        Back to my dashboard
      </NuxtLink>
    </div>

    <div class="mb-5 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
      <FormField label="Find tournament">
        <input
          v-model="searchQuery"
          type="search"
          class="input input-bordered w-full"
          placeholder="Search by name, slug, city, or country"
        >
      </FormField>

      <div class="tabs tabs-boxed">
        <button
          class="tab"
          :class="{ 'tab-active': statusFilter === 'all' }"
          @click="statusFilter = 'all'"
        >
          All
        </button>
        <button
          class="tab"
          :class="{ 'tab-active': statusFilter === 'active' }"
          @click="statusFilter = 'active'"
        >
          Active
        </button>
        <button
          class="tab"
          :class="{ 'tab-active': statusFilter === 'future' }"
          @click="statusFilter = 'future'"
        >
          Future
        </button>
        <button
          class="tab"
          :class="{ 'tab-active': statusFilter === 'past' }"
          @click="statusFilter = 'past'"
        >
          Past
        </button>
      </div>
    </div>

    <PageLoadingState v-if="tournamentStore.loading" />

    <EmptyStateAlert
      v-else-if="filteredTournaments.length === 0"
      message="No tournaments matched your filters, or you do not currently have tournament-admin access."
    />

    <div v-else class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      <NuxtLink
        v-for="tournament in filteredTournaments"
        :key="tournament.membershipId"
        :to="`/dashboard/tournaments/${tournament.tournamentSlug}`"
        class="card border border-base-300 bg-base-100 hover:border-primary transition-colors"
      >
        <div class="card-body p-4">
          <div class="flex items-start justify-between gap-2">
            <h2 class="card-title text-lg leading-tight">
              {{ tournament.tournamentName }}
            </h2>
            <span class="badge badge-outline capitalize">{{ tournament.role }}</span>
          </div>

          <p class="text-sm opacity-70">
            {{ tournament.city || "Unknown city" }}, {{ tournament.country || "Unknown country" }}
          </p>

          <p class="text-sm opacity-60">
            {{ formatDateRange(tournament.startDate, tournament.endDate) }}
          </p>

          <div class="card-actions justify-end">
            <span class="btn btn-primary btn-sm">Open Workspace</span>
          </div>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>
