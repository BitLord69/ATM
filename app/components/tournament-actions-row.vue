<script setup lang="ts">
const props = withDefaults(defineProps<{
  justify?: "between" | "end" | "start";
  marginTop?: "auto" | "sm" | "md";
}>(), {
  justify: "between",
  marginTop: "auto",
});

const justifyClass = computed(() => {
  if (props.justify === "end") {
    return "justify-end";
  }
  if (props.justify === "start") {
    return "justify-start";
  }
  return "justify-between";
});

const marginTopClass = computed(() => {
  if (props.marginTop === "sm") {
    return "mt-3";
  }
  if (props.marginTop === "md") {
    return "mt-4";
  }
  return "mt-auto";
});
</script>

<template>
  <div :class="`pt-3 border-t border-base-300 ${marginTopClass} flex gap-2 ${justifyClass}`">
    <slot />
  </div>
</template>
