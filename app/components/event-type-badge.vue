<script setup lang="ts">
/**
 * Event Type Badge Component
 * Displays badges for different disc sport disciplines
 */

import type { DisciplineType } from "~/composables/use-discipline-catalog";

import { disciplineByType } from "~/composables/use-discipline-catalog";

type Props = {
  type: DisciplineType;
  size?: "xs" | "sm" | "md" | "lg";
};

const props = withDefaults(defineProps<Props>(), {
  size: "xs",
});

const info = computed(() => disciplineByType[props.type]);
const iconSize = computed(() => {
  if (props.size === "xs") {
    return 12;
  }
  if (props.size === "sm") {
    return 14;
  }
  if (props.size === "md") {
    return 16;
  }
  return 18;
});

function handleClick() {
  navigateTo(`/disciplines/${info.value.publicSlug}`);
}
</script>

<template>
  <span
    class="badge badge-neutral cursor-pointer hover:badge-primary transition-colors gap-1"
    :class="`badge-${size}`"
    @click="handleClick"
  >
    <Icon :name="info.icon" :size="iconSize" />
    <span>{{ info.label }}</span>
  </span>
</template>
