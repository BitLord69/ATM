<script setup lang="ts">
import LogoutButton from "./logout-button.vue";
import ThemeToggle from "./theme-toggle.vue";

const authStore = useAuthStore();
const authUiReady = ref(false);

onMounted(() => {
  void authStore.checkSession();
  authUiReady.value = true;
});
</script>

<template>
  <div class="navbar bg-primary text-primary-content">
    <div class="navbar-start">
      <NuxtLink to="/" class="btn-outline">
        <img
          src="/logo-symbol.png"
          srcset="/logo-symbol-32.png 32w, /logo-symbol-64.png 64w, /logo-symbol-128.png 128w"
          sizes="(max-width: 640px) 24px, 40px"
          alt="Logo"
          class="w-6 sm:w-6 md:w-10 mr-2 inline-block prefers-dark-logo dark:invert dark:brightness-125"
        >
      </NuxtLink>
    </div>
    <div class="navbar-center hidden lg:flex">
      <ul class="menu menu-horizontal px-1 gap-1">
        <li>
          <NuxtLink
            to="/tournaments"
            class="btn btn-ghost"
          >
            Tournaments
          </NuxtLink>
        </li>
        <li v-if="authUiReady && authStore.isSignedIn">
          <NuxtLink
            to="/dashboard"
            class="btn btn-ghost"
          >
            Dashboard
          </NuxtLink>
        </li>
      </ul>
    </div>
    <div class="navbar-end gap-2">
      <ThemeToggle />
      <LogoutButton v-if="authUiReady && authStore.isSignedIn" />
      <button
        v-else-if="authUiReady"
        class="btn btn-accent"
        :disabled="authStore.loading"
        @click="navigateTo('/signin')"
      >
        <span v-if="authStore.loading" class="loading loading-spinner loading-sm" />
        <span v-else>Sign in</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
/* Fallback for OS-level dark mode (for browsers without Tailwind `dark:` enabled) */
@media (prefers-color-scheme: dark) {
  .prefers-dark-logo {
    filter: invert(1) brightness(1.15);
  }
}
</style>
