<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(defineProps<{
  hasGolf?: boolean;
  hasAccuracy?: boolean;
  hasDistance?: boolean;
  hasSCF?: boolean;
  hasDiscathon?: boolean;
  hasDDC?: boolean;
  hasFreestyle?: boolean;
  size?: "sm" | "md" | "lg";
  wrapperClass?: string;
}>(), {
  hasGolf: false,
  hasAccuracy: false,
  hasDistance: false,
  hasSCF: false,
  hasDiscathon: false,
  hasDDC: false,
  hasFreestyle: false,
  size: "md",
  wrapperClass: "",
});

const hasAny = computed(() => (
  props.hasGolf
  || props.hasAccuracy
  || props.hasDistance
  || props.hasSCF
  || props.hasDiscathon
  || props.hasDDC
  || props.hasFreestyle
));
</script>

<template>
  <div
    v-if="hasAny"
    :class="wrapperClass"
  >
    <EventTypeBadge
      v-if="hasGolf"
      type="golf"
      :size="size"
    />
    <EventTypeBadge
      v-if="hasAccuracy"
      type="accuracy"
      :size="size"
    />
    <EventTypeBadge
      v-if="hasDistance"
      type="distance"
      :size="size"
    />
    <EventTypeBadge
      v-if="hasSCF"
      type="scf"
      :size="size"
    />
    <EventTypeBadge
      v-if="hasDiscathon"
      type="discathon"
      :size="size"
    />
    <EventTypeBadge
      v-if="hasDDC"
      type="ddc"
      :size="size"
    />
    <EventTypeBadge
      v-if="hasFreestyle"
      type="freestyle"
      :size="size"
    />
  </div>
</template>
