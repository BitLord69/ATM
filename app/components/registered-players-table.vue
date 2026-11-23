<script setup lang="ts">
import type {
  DisciplineOption,
  MajorDivisionOption,
  TournamentPlayerGroup,
} from "~/types/tournament-registration";

const props = defineProps<{
  players: TournamentPlayerGroup[];
  majorDivisions: MajorDivisionOption[];
  enabledDisciplines: DisciplineOption[];
  loading: boolean;
  busy: boolean;
  canManage: boolean;
}>();

const emit = defineEmits<{
  edit: [player: TournamentPlayerGroup];
  toggleWithdrawal: [player: TournamentPlayerGroup];
  refresh: [];
}>();

const searchQuery = ref("");
const statusFilter = ref<"all" | "registered" | "withdrawn">("all");
const divisionFilter = ref("all");

const disciplineLabelByKey = computed(() => {
  const map = new Map<string, string>(props.enabledDisciplines.map(d => [d.key, d.label]));
  map.set("overall", "Overall");
  return map;
});

function getDisciplineLabel(key: string) {
  return disciplineLabelByKey.value.get(key) || key;
}

const filteredPlayers = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();

  return props.players.filter((item) => {
    if (statusFilter.value !== "all" && item.overallStatus !== statusFilter.value) {
      return false;
    }
    if (divisionFilter.value !== "all" && item.majorDivision !== divisionFilter.value) {
      return false;
    }
    if (!q) {
      return true;
    }
    return item.displayName.toLowerCase().includes(q)
      || (item.country || "").toLowerCase().includes(q)
      || (item.email || "").toLowerCase().includes(q)
      || (item.pdgaNumber || "").toLowerCase().includes(q)
      || String(item.playerNumber ?? "").includes(q);
  });
});
</script>

<template>
  <div class="space-y-3">
    <search class="flex flex-wrap items-center justify-between gap-2">
      <div class="flex flex-wrap items-center gap-2 flex-1">
        <label
          for="player-search-input"
          class="sr-only"
        >Search players</label>
        <input
          id="player-search-input"
          v-model="searchQuery"
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
          v-model="statusFilter"
          class="select select-bordered select-sm"
        >
          <option value="all">
            All statuses
          </option>
          <option value="registered">
            Registered only
          </option>
          <option value="withdrawn">
            Withdrawn only
          </option>
        </select>

        <label
          for="player-division-filter"
          class="sr-only"
        >Filter by division</label>
        <select
          id="player-division-filter"
          v-model="divisionFilter"
          class="select select-bordered select-sm"
        >
          <option value="all">
            All major divisions
          </option>
          <option
            v-for="div in majorDivisions"
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
        :disabled="loading"
        @click="emit('refresh')"
      >
        Refresh
      </button>
    </search>

    <PageLoadingState
      v-if="loading"
      wrapper-class="py-8"
    />

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
            <th>Major div</th>
            <th>Minor / age divs</th>
            <th>Disciplines</th>
            <th>Status</th>
            <th
              v-if="canManage"
              class="text-right"
            >
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
            <th
              scope="row"
              class="font-normal"
            >
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
            </th>
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
            <td
              v-if="canManage"
              class="text-right"
            >
              <div class="flex items-center justify-end gap-1">
                <button
                  type="button"
                  class="btn btn-xs btn-ghost"
                  :disabled="busy"
                  @click="emit('edit', p)"
                >
                  Edit
                </button>
                <button
                  type="button"
                  class="btn btn-xs"
                  :class="p.overallStatus === 'registered' ? 'btn-error btn-outline' : 'btn-success btn-outline'"
                  :disabled="busy"
                  @click="emit('toggleWithdrawal', p)"
                >
                  {{ p.overallStatus === "registered" ? "Withdraw" : "Restore" }}
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="filteredPlayers.length === 0">
            <td
              :colspan="canManage ? 8 : 7"
              class="text-center text-sm opacity-70 py-6"
            >
              No registered players match the current filter.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
