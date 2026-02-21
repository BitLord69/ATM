<script setup lang="ts">
import { useAuthClient } from "~/stores/auth";

import LogoutButton from "./logout-button.vue";
import ThemeToggle from "./theme-toggle.vue";

const authClient = useAuthClient();
const isLoggedIn = ref(false);

async function checkSession() {
  const session = await authClient.getSession();
  isLoggedIn.value = !!session?.data?.user;
}

onMounted(() => {
  void checkSession();
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
        <li v-if="isLoggedIn">
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
      <LogoutButton v-if="isLoggedIn" />
      <NuxtLink
        v-else
        to="/signin"
        class="btn btn-accent"
      >
        Sign in
      </NuxtLink>
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
