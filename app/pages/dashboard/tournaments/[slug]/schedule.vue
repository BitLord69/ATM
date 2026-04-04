<script setup lang="ts">
definePageMeta({ ssr: false, layout: "tournament-admin" });
</script>

<template>
  <div>
    <FormHeader
      title="Schedule"
      title-tag="h1"
      title-class="text-2xl font-bold"
      wrapper-class="mb-3"
    />

    <EmptyStateAlert
      message="This page is reserved for creating the overall tournament schedule by discipline and round."
    />
  </div>
</template>
