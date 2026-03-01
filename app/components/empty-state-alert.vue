<script setup lang="ts">
withDefaults(defineProps<{
  message: string;
  icon?: string;
  alertClass?: string;
}>(), {
  icon: "tabler:info-circle",
  alertClass: "alert alert-info",
});
</script>

<template>
  <div :class="alertClass">
    <Icon
      :name="icon"
      size="24"
    />
    <span>{{ message }}</span>
  </div>
</template>
