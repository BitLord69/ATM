import type { TournamentRole } from "~/lib/db/schema/tournament-membership";

export type TournamentMembership = {
  membershipId: string;
  tournamentId: number;
  organizationId: string;
  role: TournamentRole;
  status: string;
  tournamentName: string;
  tournamentSlug: string;
  tournamentDescription: string | null;
  country: string | null;
  city: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  contactUserId: string | null;
  startDate: number | null;
  endDate: number | null;
  hasGolf: boolean | null;
  hasAccuracy: boolean | null;
  hasDistance: boolean | null;
  hasSCF: boolean | null;
  hasDiscathon: boolean | null;
  hasDDC: boolean | null;
  hasFreestyle: boolean | null;
  tournamentStatus: "active" | "future" | "past";
  isActive: boolean;
};

export const useTournamentStore = defineStore("tournament", () => {
  const tournaments = ref<TournamentMembership[]>([]);
  const activeTournament = ref<TournamentMembership | null>(null);
  const isSysadmin = ref(false);
  const loading = ref(false);
  const showTournamentSelector = ref(false);

  async function loadTournaments() {
    loading.value = true;
    try {
      const data = await $fetch("/api/tournaments/my-tournaments");
      tournaments.value = data.tournaments;
      isSysadmin.value = data.isSysadmin;

      // Auto-select logic after login
      const activeTournaments = tournaments.value.filter(t => t.tournamentStatus === "active");

      if (activeTournaments.length === 1) {
        // Only one active tournament, auto-select it
        activeTournament.value = activeTournaments[0];
      }
      else if (activeTournaments.length > 1 && !isSysadmin.value) {
        // Multiple active tournaments and user is not sysadmin or TD
        const isPrivileged = activeTournaments.some(t => ["owner", "admin", "td"].includes(t.role));
        if (!isPrivileged) {
          // Show selector modal
          showTournamentSelector.value = true;
        }
      }
    }
    catch (error) {
      console.error("Failed to load tournaments:", error);
    }
    finally {
      loading.value = false;
    }
  }

  function selectTournament(tournament: TournamentMembership) {
    activeTournament.value = tournament;
    showTournamentSelector.value = false;
  }

  function clearActiveTournament() {
    activeTournament.value = null;
  }

  const filteredTournaments = computed(() => {
    return (filter: "all" | "active" | "future" | "past", sortBy: "date" | "name" | "country" | "city" = "date", sortDirection: "asc" | "desc" = "desc") => {
      const filtered = filter === "all"
        ? tournaments.value
        : tournaments.value.filter(t => t.tournamentStatus === filter);

      // Sort the filtered list
      const sorted = filtered.slice().sort((a, b) => {
        let comparison = 0;
        switch (sortBy) {
          case "name":
            comparison = a.tournamentName.localeCompare(b.tournamentName);
            break;
          case "country":
            comparison = (a.country || "").localeCompare(b.country || "");
            break;
          case "city":
            comparison = (a.city || "").localeCompare(b.city || "");
            break;
          case "date":
          default:
            // Sort by start date
            comparison = (a.startDate || 0) - (b.startDate || 0);
            break;
        }
        return sortDirection === "asc" ? comparison : -comparison;
      });

      return sorted;
    };
  });

  const hasActiveTournaments = computed(() => {
    return tournaments.value.some(t => t.tournamentStatus === "active");
  });

  return {
    tournaments,
    activeTournament,
    isSysadmin,
    loading,
    showTournamentSelector,
    loadTournaments,
    selectTournament,
    clearActiveTournament,
    filteredTournaments,
    hasActiveTournaments,
  };
});
