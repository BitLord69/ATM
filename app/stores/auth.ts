import { createAuthClient } from "better-auth/client";

const authClient = createAuthClient();

export type loginProviders = "email" | "github" | "google" | "facebook";

export const useAuthStore = defineStore("useaAuthStore", () => {
  const loading = ref(false);
  const isSignedIn = ref(false);

  async function signIn(_provider: loginProviders) {
    loading.value = true;

    await authClient.signIn.social({
      provider: _provider,
      callbackURL: "/dashboard",
      errorCallbackURL: "/error",
    });

    loading.value = false;
  }

  async function checkSession() {
    loading.value = true;
    const session = await authClient.getSession();
    isSignedIn.value = !!session.data;
    loading.value = false;
  }

  return {
    loading,
    isSignedIn,
    signIn,
    checkSession,
  };
});
