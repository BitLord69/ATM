<script setup lang="ts">
type Props = {
  title: string;
  description?: string;
  titleTag?: "h1" | "h2" | "h3" | "h4";
  titleClass?: string;
  descriptionClass?: string;
  wrapperClass?: string;
  descriptionMaxWidthClass?: string;
};

withDefaults(defineProps<Props>(), {
  description: "",
  titleTag: "h2",
  titleClass: "font-bold",
  descriptionClass: "text-sm opacity-70",
  wrapperClass: "",
  descriptionMaxWidthClass: "md:max-w-xl",
});
</script>

<template>
  <div
    class="flex flex-col gap-1 md:flex-row md:items-end md:justify-between md:gap-4"
    :class="wrapperClass"
  >
    <component
      :is="titleTag"
      :class="titleClass"
    >
      {{ title }}
    </component>

    <p
      v-if="description"
      class="md:text-right"
      :class="[descriptionClass, descriptionMaxWidthClass]"
    >
      {{ description }}
    </p>
  </div>
</template>
