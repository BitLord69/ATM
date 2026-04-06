<script setup lang="ts">
type Props = {
  modelValue: boolean | Array<string | number>;
  label: string;
  icon?: string;
  value?: string | number;
  disabled?: boolean;
  tooltip?: string;
  labelClass?: string;
  size?: "sm" | "md" | "lg";
  stacked?: boolean;
  desktopInline?: boolean;
};

type Emits = {
  (e: "update:modelValue", value: boolean | Array<string | number>): void;
};

const props = withDefaults(defineProps<Props>(), {
  icon: "",
  disabled: false,
  tooltip: "",
  labelClass: "",
  size: "sm",
  stacked: true,
  desktopInline: false,
});

const emit = defineEmits<Emits>();

const layoutClass = computed(() => {
  if (props.desktopInline && props.stacked) {
    return "flex-col items-start md:flex-row md:items-center md:justify-start";
  }

  return props.stacked ? "flex-col items-start" : "flex-row items-center justify-between";
});

const spacingClass = computed(() => {
  if (props.desktopInline && props.stacked) {
    return "gap-1 md:gap-2";
  }

  return props.stacked ? "gap-1" : "gap-2";
});

const widthClass = computed(() => (props.desktopInline ? "md:w-auto" : ""));
const sizeClass = computed(() => `toggle-${props.size}`);
const toneClass = "bg-error/20 border-error/40 checked:bg-success/25 checked:border-success/40 before:bg-error/50 checked:before:bg-success/70";

const checked = computed(() => {
  if (Array.isArray(props.modelValue)) {
    if (props.value === undefined) {
      return false;
    }
    return props.modelValue.includes(props.value);
  }
  return Boolean(props.modelValue);
});

function onChange(event: Event) {
  const target = event.target as HTMLInputElement;

  if (Array.isArray(props.modelValue)) {
    if (props.value === undefined) {
      return;
    }
    const next = [...props.modelValue];
    const index = next.indexOf(props.value);

    if (target.checked && index === -1) {
      next.push(props.value);
    }
    else if (!target.checked && index !== -1) {
      next.splice(index, 1);
    }

    emit("update:modelValue", next);
    return;
  }

  emit("update:modelValue", target.checked);
}
</script>

<template>
  <label
    class="label cursor-pointer py-0.5"
    :class="[layoutClass, spacingClass, widthClass, disabled ? 'opacity-50' : '']"
    :title="tooltip || undefined"
  >
    <span class="label-text inline-flex items-center gap-1.5" :class="labelClass">
      <Icon
        v-if="icon"
        :name="icon"
        size="15"
        class="opacity-85"
      />
      <span>{{ label }}</span>
    </span>
    <input
      type="checkbox"
      class="toggle"
      :class="[sizeClass, toneClass]"
      :checked="checked"
      :disabled="disabled"
      @change="onChange"
    >
  </label>
</template>
