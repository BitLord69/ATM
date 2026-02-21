<script setup lang="ts">
/**
 * Event Type Badge Component
 * Displays badges for different disc sport disciplines
 */

type EventType = "golf" | "accuracy" | "distance" | "scf" | "discathon" | "ddc" | "freestyle";

type Props = {
  type: EventType;
  size?: "xs" | "sm" | "md" | "lg";
};

const props = withDefaults(defineProps<Props>(), {
  size: "xs",
});

const eventInfo: Record<EventType, { label: string; slug: string }> = {
  golf: { label: "Golf", slug: "golf" },
  accuracy: { label: "Accuracy", slug: "accuracy" },
  distance: { label: "Distance", slug: "distance" },
  scf: { label: "SCF", slug: "self-caught-flight" },
  discathon: { label: "Discathon", slug: "discathon" },
  ddc: { label: "DDC", slug: "ddc" },
  freestyle: { label: "Freestyle", slug: "freestyle" },
};

const info = computed(() => eventInfo[props.type]);

function handleClick() {
  navigateTo(`/disciplines/${info.value.slug}`);
}
</script>

<template>
  <span
    class="badge badge-neutral cursor-pointer hover:badge-primary transition-colors"
    :class="`badge-${size}`"
    @click="handleClick"
  >
    {{ info.label }}
  </span>
</template>
