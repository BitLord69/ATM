<script setup lang="ts">
type Props = {
  modelValue: boolean | Array<string | number>;
  label: string;
  value?: string | number;
  disabled?: boolean;
  tooltip?: string;
  size?: "sm" | "md" | "lg";
  stacked?: boolean;
};

type Emits = {
  (e: "update:modelValue", value: boolean | Array<string | number>): void;
};

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  tooltip: "",
  size: "sm",
  stacked: true,
});

const emit = defineEmits<Emits>();

const layoutClass = computed(() => (props.stacked ? "flex-col items-start" : "flex-row items-center justify-between"));
const sizeClass = computed(() => `toggle-${props.size}`);

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
    class="label cursor-pointer gap-3"
    :class="[layoutClass, disabled ? 'opacity-50' : '']"
    :title="tooltip || undefined"
  >
    <span class="label-text">{{ label }}</span>
    <input
      type="checkbox"
      class="toggle"
      :class="sizeClass"
      :checked="checked"
      :disabled="disabled"
      @change="onChange"
    >
  </label>
</template>
