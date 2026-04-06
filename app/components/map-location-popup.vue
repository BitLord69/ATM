<script setup lang="ts">
withDefaults(defineProps<{
  title: string;
  titleTo?: string | null;
  subtitle?: string | null;
  description?: string | null;
  facilities?: string | null;
  hasGolf?: boolean;
  hasAccuracy?: boolean;
  hasDistance?: boolean;
  hasSCF?: boolean;
  hasDiscathon?: boolean;
  hasDDC?: boolean;
  hasFreestyle?: boolean;
  centered?: boolean;
}>(), {
  titleTo: null,
  subtitle: null,
  description: null,
  facilities: null,
  hasGolf: false,
  hasAccuracy: false,
  hasDistance: false,
  hasSCF: false,
  hasDiscathon: false,
  hasDDC: false,
  hasFreestyle: false,
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
    <div :class="centered ? 'flex justify-center mt-2' : 'mt-2'">
      <DisciplineIcons
        :has-golf="hasGolf"
        :has-accuracy="hasAccuracy"
        :has-distance="hasDistance"
        :has-scf="hasSCF"
        :has-discathon="hasDiscathon"
        :has-ddc="hasDDC"
        :has-freestyle="hasFreestyle"
        :icon-size="16"
        gap-class="gap-1"
      />
    </div>
    <slot />
  </div>
</template>
