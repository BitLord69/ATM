import { createAuthClient } from "better-auth/client";
import { inferAdditionalFields, organizationClient } from "better-auth/client/plugins";

let authClientInstance: ReturnType<typeof createAuthClient> | null = null;
let authConfigLogged = false;

export function useAuthClient() {
  if (authClientInstance) {
    return authClientInstance;
  }

  const config = useRuntimeConfig();
  const baseURL = config.public.betterAuthUrl || undefined;

  if (!authConfigLogged) {
    const target = baseURL || "(same-origin default)";
    console.warn(`[auth] baseURL=${target}`);
    authConfigLogged = true;
  }

  authClientInstance = createAuthClient({
    baseURL,
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

    // Note: loading.value = false is not needed since we redirect away
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
    try {
      const session = await authClient.getSession();
      isSignedIn.value = !!session.data;
      currentUser.value = session.data?.user || null;
      return session.data;
    }
    catch (error) {
      // Treat network/config failures as signed-out state instead of crashing app init.
      console.warn("[auth] checkSession failed", error);
      isSignedIn.value = false;
      currentUser.value = null;
      return null;
    }
    finally {
      loading.value = false;
    }
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
