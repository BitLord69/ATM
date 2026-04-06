<script setup lang="ts">
import type { DisciplineKey } from "~/composables/use-discipline-catalog";

/**
 * Discipline Icons Component
 * Displays small icon badges for disc sport disciplines
 * Used in map popups and compact views
 */
import { disciplineByKey, disciplineKeyOrder } from "~/composables/use-discipline-catalog";

type Props = {
  hasGolf?: boolean;
  hasAccuracy?: boolean;
  hasDistance?: boolean;
  hasSCF?: boolean;
  hasDiscathon?: boolean;
  hasDDC?: boolean;
  hasFreestyle?: boolean;
  iconSize?: number;
  gapClass?: string;
};

const props = withDefaults(defineProps<Props>(), {
  hasGolf: false,
  hasAccuracy: false,
  hasDistance: false,
  hasSCF: false,
  hasDiscathon: false,
  hasDDC: false,
  hasFreestyle: false,
  iconSize: 18,
  gapClass: "gap-2",
});

const enabledByKey = computed<Record<DisciplineKey, boolean>>(() => ({
  hasGolf: props.hasGolf,
  hasAccuracy: props.hasAccuracy,
  hasDistance: props.hasDistance,
  hasSCF: props.hasSCF,
  hasDiscathon: props.hasDiscathon,
  hasDDC: props.hasDDC,
  hasFreestyle: props.hasFreestyle,
}));

const disciplines = computed(() =>
  disciplineKeyOrder
    .filter(key => enabledByKey.value[key])
    .map(key => disciplineByKey[key]),
);

const hasAny = computed(() => disciplines.value.length > 0);
</script>

<template>
  <div
    v-if="hasAny"
    class="flex items-center"
    :class="gapClass"
  >
    <span
      v-for="discipline in disciplines"
      :key="discipline.type"
      class="inline-flex items-center justify-center p-1.5 rounded-md bg-primary/10 hover:bg-primary/20 transition-colors cursor-help"
      :title="discipline.label"
    >
      <Icon
        :name="discipline.icon"
        :size="iconSize"
        class="text-primary"
      />
    </span>
  </div>
</template>
