import { createAuthClient } from "better-auth/client";
import { inferAdditionalFields, organizationClient } from "better-auth/client/plugins";

let authClientInstance: ReturnType<typeof createAuthClient> | null = null;

export function useAuthClient() {
  if (authClientInstance) {
    return authClientInstance;
  }

  const config = useRuntimeConfig();

  authClientInstance = createAuthClient({
    baseURL: config.public.betterAuthUrl,
    plugins: [
      // Required for invitation and multi-tenant features
      organizationClient(),
      inferAdditionalFields(),
    ],
  });

  return authClientInstance;
}

export type loginProviders = "email" | "github" | "google" | "facebook";

export const useAuthStore = defineStore("useAuthStore", () => {
  const loading = ref(false);
  const isSignedIn = ref(false);
  const currentUser = ref<any>(null);
  const authClient = useAuthClient();

  async function signIn(_provider: loginProviders) {
    loading.value = true;

    await authClient.signIn.social({
      provider: _provider,
      callbackURL: "/dashboard",
      errorCallbackURL: "/error",
    });

    loading.value = false;
  }

  async function signOut() {
    loading.value = true;
    try {
      await authClient.signOut();

      // Clear state regardless of API success
      isSignedIn.value = false;
      currentUser.value = null;

      // Clear tournament context on logout
      const tournamentStore = useTournamentStore();
      tournamentStore.$reset();

      // Navigate to home page
      await navigateTo("/");
    }
    catch (error) {
      console.error("Logout error:", error);
      // Still clear local state and navigate even if API call fails
      isSignedIn.value = false;
      currentUser.value = null;
      await navigateTo("/");
    }
    finally {
      loading.value = false;
    }
  }

  async function checkSession() {
    loading.value = true;
    const session = await authClient.getSession();
    isSignedIn.value = !!session.data;
    currentUser.value = session.data?.user || null;
    loading.value = false;
    return session.data;
  }

  return {
    loading,
    isSignedIn,
    currentUser,
    signIn,
    signOut,
    checkSession,
  };
});
