<script setup lang="ts">
const props = withDefaults(defineProps<{
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  wrapperClass?: string;
}>(), {
  required: false,
  error: "",
  hint: "",
  wrapperClass: "",
});
</script>

<template>
  <label class="form-control w-full" :class="[props.wrapperClass]">
    <span class="label-text min-h-6">
      {{ props.label }}
      <span
        v-if="props.required"
        class="text-error"
      >*</span>
    </span>

    <slot />

    <span
      v-if="props.error"
      class="label-text-alt text-error"
    >
      {{ props.error }}
    </span>
    <span
      v-else-if="props.hint"
      class="label-text-alt"
    >
      {{ props.hint }}
    </span>
  </label>
</template>
