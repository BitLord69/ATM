<script setup lang="ts">
withDefaults(defineProps<{
  text?: string | null;
  wrapperClass?: string;
  spinnerClass?: string;
  textClass?: string;
}>(), {
  text: null,
  wrapperClass: "py-12",
  spinnerClass: "",
  textClass: "text-sm opacity-70",
});
</script>

<template>
  <div :class="`flex justify-center items-center ${wrapperClass}`">
    <div :class="text ? 'flex flex-col items-center gap-4' : ''">
      <span :class="`loading loading-spinner loading-lg ${spinnerClass}`" />
      <p
        v-if="text"
        :class="textClass"
      >
        {{ text }}
      </p>
    </div>
  </div>
</template>
