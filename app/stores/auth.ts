import { createAuthClient } from "better-auth/client";
import { inferAdditionalFields, organizationClient } from "better-auth/client/plugins";

let authClientInstance: ReturnType<typeof createAuthClient> | null = null;

function resolveAuthBaseURL(rawValue: unknown) {
  const raw = String(rawValue ?? "").trim();
  if (!raw) {
    return undefined;
  }

  // Vercel variable placeholders must be resolved before runtime; if not,
  // treat as invalid and fallback to same-origin behavior.
  const bracedVercelToken = "$" + "{VERCEL_URL}";
  if (raw.includes("$VERCEL.URL") || raw.includes("$VERCEL_URL") || raw.includes(bracedVercelToken)) {
    if (import.meta.client && window.location?.origin) {
      return window.location.origin;
    }
    return undefined;
  }

  // Support domain-only values by normalizing to https.
  if (!/^https?:\/\//i.test(raw) && !raw.startsWith("/")) {
    return `https://${raw}`;
  }

  // During SSR in local dev, Nuxt may run on an alternate port (e.g. 3001)
  // while env still points to 3000. Prefer same-origin behavior on server.
  if (import.meta.server && /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i.test(raw)) {
    return undefined;
  }

  // In local dev, Nuxt may switch ports (e.g. 3000 -> 3001). Use same-origin
  // so auth requests always target the currently running dev server.
  if (import.meta.client && window.location?.origin) {
    try {
      const parsed = new URL(raw, window.location.origin);
      const isLocalhost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
      if (isLocalhost && parsed.origin !== window.location.origin) {
        return window.location.origin;
      }
    }
    catch {
      // Fall through to raw if URL parsing fails.
    }
  }

  return raw;
}

export function useAuthClient() {
  if (authClientInstance) {
    return authClientInstance;
  }

  const config = useRuntimeConfig();
  const baseURL = resolveAuthBaseURL(config.public.betterAuthUrl);

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

export type socialLoginProvider = "github" | "google" | "facebook";

export const useAuthStore = defineStore("useAuthStore", () => {
  const loading = ref(false);
  const isSignedIn = ref(false);
  const currentUser = ref<any>(null);
  const authClient = useAuthClient();

  async function signInSocial(provider: socialLoginProvider) {
    loading.value = true;
    try {
      const { error } = await authClient.signIn.social({
        provider,
        callbackURL: `/dashboard?socialConnected=${encodeURIComponent(provider)}`,
        errorCallbackURL: "/error?flow=social",
      });

      if (error) {
        return { ok: false, error: error.message || "Unable to start social sign-in." };
      }

      return { ok: true, error: null };
    }
    catch {
      return { ok: false, error: "Unable to start social sign-in." };
    }
    finally {
      loading.value = false;
    }
  }

  async function signInEmail(email: string, password: string) {
    loading.value = true;

    try {
      const { error } = await authClient.signIn.email({
        email,
        password,
      });

      if (error) {
        return { ok: false, error: error.message || "Invalid email or password." };
      }

      // Sync store state immediately after sign-in so navbar/UI updates
      // without waiting for a full app reload.
      const session = await authClient.getSession();
      isSignedIn.value = !!session.data;
      currentUser.value = session.data?.user || null;

      return { ok: true, error: null };
    }
    finally {
      loading.value = false;
    }
  }

  async function requestPasswordReset(email: string) {
    loading.value = true;

    try {
      await $fetch("/api/auth/forgot-password", {
        method: "POST",
        body: { email },
      });

      return { ok: true, error: null };
    }
    catch (error: any) {
      const message = error?.data?.message || error?.message || "Unable to request password reset.";
      console.warn("[auth] requestPasswordReset failed", error);
      return { ok: false, error: message };
    }
    finally {
      loading.value = false;
    }
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
    signInSocial,
    signInEmail,
    requestPasswordReset,
    signOut,
    checkSession,
  };
});
