<script setup lang="ts">
import ThemeToggle from "./theme-toggle.vue";
</script>

<template>
  <div class="navbar bg-primary text-primary-content">
    <div class="navbar-start">
      <NuxtLink to="/" class="btn-outline">
        <img
          src="/logo-symbol.png"
          srcset="/logo-symbol-32.png 32w, /logo-symbol-64.png 64w, /logo-symbol-128.png 128w"
          sizes="(max-width: 640px) 64px, 128px"
          alt="Logo"
          class="w-12 sm:w-8 md:w-18 mr-2 inline-block prefers-dark-logo dark:invert dark:brightness-125"
        >
      </NuxtLink>
    </div>
    <div class="navbar-end">
      <ThemeToggle />
      <NuxtLink
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
