<script setup lang="ts">
type DistanceUnit = "km" | "mi";

const props = withDefaults(defineProps<{
  modelValue: number;
  options?: number[];
  label?: string;
  showUnitToggle?: boolean;
  displayUnit?: DistanceUnit;
}>(), {
  options: () => [50, 100, 200, 300, 500, 1000],
  label: "Search radius",
  showUnitToggle: false,
  displayUnit: "km",
});

const emit = defineEmits<{
  (event: "update:modelValue", value: number): void;
  (event: "update:displayUnit", value: DistanceUnit): void;
}>();

const unit = ref<DistanceUnit>(props.displayUnit);

watch(
  () => props.displayUnit,
  (value) => {
    unit.value = value;
  },
);

const selected = computed({
  get: () => String(props.modelValue),
  set: (value: string) => {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) {
      emit("update:modelValue", numeric);
    }
  },
});

function setUnit(nextUnit: DistanceUnit) {
  if (unit.value === nextUnit) {
    return;
  }
  unit.value = nextUnit;
  emit("update:displayUnit", nextUnit);
}

function formatRadiusLabel(radiusKm: number) {
  if (unit.value === "mi") {
    const miles = radiusKm * 0.621371;
    const rounded = miles >= 100 ? Math.round(miles) : Number(miles.toFixed(1));
    return `${rounded} mi`;
  }
  return `${radiusKm} km`;
}
</script>

<template>
  <FormField :label="label" wrapper-class="!w-auto shrink-0">
    <div class="flex items-center gap-2 whitespace-nowrap">
      <select
        v-model="selected"
        class="select select-bordered select-sm w-40"
      >
        <option
          v-for="radius in options"
          :key="radius"
          :value="String(radius)"
        >
          {{ formatRadiusLabel(radius) }}
        </option>
      </select>

      <div
        v-if="showUnitToggle"
        class="join"
        aria-label="Distance unit"
      >
        <button
          type="button"
          class="btn btn-xs join-item"
          :class="unit === 'km' ? 'btn-primary' : 'btn-ghost'"
          title="Kilometers"
          aria-label="Kilometers"
          :aria-pressed="unit === 'km'"
          @click="setUnit('km')"
        >
          <Icon name="tabler:map-2" class="size-3.5" />
          km
        </button>
        <button
          type="button"
          class="btn btn-xs join-item"
          :class="unit === 'mi' ? 'btn-primary' : 'btn-ghost'"
          title="Miles"
          aria-label="Miles"
          :aria-pressed="unit === 'mi'"
          @click="setUnit('mi')"
        >
          <Icon name="tabler:route-2" class="size-3.5" />
          mi
        </button>
      </div>
    </div>
  </FormField>
</template>
