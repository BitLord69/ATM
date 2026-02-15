<script setup lang="ts">
import { useTournamentStore } from "~/stores/tournament";

const tournamentStore = useTournamentStore();

const activeTournaments = computed(() =>
  tournamentStore.tournaments.filter(t => t.tournamentStatus === "active"),
);

function handleSelect(tournament: any) {
  tournamentStore.selectTournament(tournament);
}
</script>

<template>
  <dialog
    class="modal"
    :class="{ 'modal-open': tournamentStore.showTournamentSelector }"
  >
    <div class="modal-box max-w-2xl">
      <h3 class="font-bold text-lg mb-4">
        Select a Tournament
      </h3>

      <div
        v-if="activeTournaments.length === 0"
        class="alert alert-info"
      >
        <Icon
          name="tabler:info-circle"
          size="24"
        />
        <span>No active tournaments available at this time.</span>
      </div>

      <div
        v-else
        class="space-y-2"
      >
        <p class="text-sm opacity-70 mb-4">
          You are a member of multiple active tournaments. Please select one to continue:
        </p>

        <div
          v-for="tournament in activeTournaments"
          :key="tournament.tournamentId"
          class="card bg-base-200 hover:bg-base-300 cursor-pointer transition"
          @click="handleSelect(tournament)"
        >
          <div class="card-body p-4">
            <h4 class="card-title text-base">
              {{ tournament.tournamentName }}
            </h4>
            <p
              v-if="tournament.tournamentDescription"
              class="text-sm opacity-70"
            >
              {{ tournament.tournamentDescription }}
            </p>
            <div class="flex items-center gap-2 text-sm mt-2">
              <span class="badge badge-primary">{{ tournament.role }}</span>
              <span
                v-if="tournament.startDate && tournament.endDate"
                class="opacity-70"
              >
                {{ new Date(tournament.startDate).toLocaleDateString() }} -
                {{ new Date(tournament.endDate).toLocaleDateString() }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-action">
        <button
          class="btn"
          @click="tournamentStore.showTournamentSelector = false"
        >
          Close
        </button>
      </div>
    </div>
    <div
      class="modal-backdrop"
      @click="tournamentStore.showTournamentSelector = false"
    />
  </dialog>
</template>
