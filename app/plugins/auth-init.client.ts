import { useAuthStore } from "~/stores/auth";
import { useTournamentStore } from "~/stores/tournament";

export default defineNuxtPlugin(async () => {
  const authStore = useAuthStore();
  const tournamentStore = useTournamentStore();

  // Hydrate auth store once on app load (client-side only)
  const session = await authStore.checkSession();

  if (session?.user) {
    // User has an active session, restore tournament context
    await tournamentStore.loadTournaments();
  }
});
