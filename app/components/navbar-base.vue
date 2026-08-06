<script setup lang="ts">
withDefaults(defineProps<{
  homeTo?: string;
}>(), {
  homeTo: "/",
});
</script>

<template>
  <div class="navbar h-16 min-h-16 px-3 sm:px-4 bg-primary text-primary-content">
    <div class="navbar-start h-full">
      <NuxtLink :to="homeTo" class="btn-outline">
        <img
          src="/logo-symbol.png"
          srcset="/logo-symbol-32.png 32w, /logo-symbol-64.png 64w, /logo-symbol-128.png 128w"
          sizes="(max-width: 640px) 24px, 40px"
          alt="Logo"
          class="w-6 sm:w-6 md:w-10 mr-2 inline-block prefers-dark-logo dark:invert dark:brightness-125"
        >
      </NuxtLink>
    </div>

    <div class="navbar-center h-full">
      <slot name="center" />
    </div>

    <div class="navbar-end h-full gap-2">
      <slot name="end" />
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
