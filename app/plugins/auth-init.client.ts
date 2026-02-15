import { useAuthClient } from "~/stores/auth";
import { useTournamentStore } from "~/stores/tournament";

export default defineNuxtPlugin(async () => {
  const authClient = useAuthClient();
  const tournamentStore = useTournamentStore();

  // Check for existing session on app load (client-side only)
  const session = await authClient.getSession();

  if (session?.data?.user) {
    // User has an active session, restore tournament context
    await tournamentStore.loadTournaments();
  }
});
