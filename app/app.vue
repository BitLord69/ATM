<script setup lang="ts">
import { useAuthStore } from "./stores/auth";

const authStore = useAuthStore();

onMounted(() => {
  authStore.checkSession();
});
</script>

<template>
  <div>
    <NavigationFeedback />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>
