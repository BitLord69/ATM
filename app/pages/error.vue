<script lang="ts" setup>
const route = useRoute();
const error = route.query.error || "An unknown error has occurred.";
</script>

<template>
  <div class="card bg-base-300 container mt-4 min-h-72 text-center mx-auto flex flex-col items-center justify-center gap-4">
    <div role="alert" class="alert alert-error min-w-1/2 text-center">
      <span>Ouchie - {{ error }}</span>
    </div>
    <NuxtLink to="/" class="btn btn-primary">
      Go back home
      <Icon name="tabler:home" size="32" />
    </NuxtLink>
  </div>
</template>
