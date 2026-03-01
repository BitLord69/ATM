<script setup lang="ts">
withDefaults(defineProps<{
  title: string;
  titleTo?: string | null;
  subtitle?: string | null;
  description?: string | null;
  facilities?: string | null;
  centered?: boolean;
}>(), {
  titleTo: null,
  subtitle: null,
  description: null,
  facilities: null,
  centered: true,
});
</script>

<template>
  <div :class="centered ? 'text-center' : ''">
    <NuxtLink
      v-if="titleTo"
      :to="titleTo"
      class="font-semibold hover:text-primary"
    >
      {{ title }}
    </NuxtLink>
    <p
      v-else
      class="font-semibold"
    >
      {{ title }}
    </p>
    <p
      v-if="subtitle"
      class="text-sm"
    >
      {{ subtitle }}
    </p>
    <p
      v-if="description"
      class="text-sm"
    >
      {{ description }}
    </p>
    <p
      v-if="facilities"
      class="text-xs opacity-70 mt-1"
    >
      {{ facilities }}
    </p>
    <slot />
  </div>
</template>
