<script setup lang="ts">
withDefaults(defineProps<{
  title: string;
  lead: string;
  ctaTitle: string;
  ctaDescription: string;
  backTo?: string;
  backLabel?: string;
  ctaTo?: string;
  ctaButtonLabel?: string;
}>(), {
  backTo: "/tournaments",
  backLabel: "Back to Tournaments",
  ctaTo: "/tournaments",
  ctaButtonLabel: "View Tournaments",
});
</script>

<template>
  <div class="container mx-auto p-4 max-w-4xl">
    <div class="mb-4">
      <NuxtLink
        :to="backTo"
        class="btn btn-ghost btn-sm gap-2"
      >
        <Icon
          name="tabler:arrow-left"
          size="18"
        />
        {{ backLabel }}
      </NuxtLink>
    </div>

    <h1 class="text-4xl font-bold mb-6">
      {{ title }}
    </h1>

    <div class="prose max-w-none">
      <p class="text-lg mb-4">
        {{ lead }}
      </p>

      <slot />

      <div class="alert alert-info mt-6">
        <Icon
          name="tabler:info-circle"
          size="24"
        />
        <div>
          <p class="font-semibold">
            {{ ctaTitle }}
          </p>
          <p class="text-sm">
            {{ ctaDescription }}
          </p>
        </div>
        <NuxtLink
          :to="ctaTo"
          class="btn btn-primary btn-sm"
        >
          {{ ctaButtonLabel }}
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
