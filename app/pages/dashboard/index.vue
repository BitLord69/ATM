<script setup lang="ts">
import { useAuthStore } from "../../stores/auth";

const authStore = useAuthStore();

onMounted(() => {
  authStore.checkSession();
});
</script>

<template>
  <div v-if="authStore.loading">
    Loading...
  </div>
  <div v-else>
    <h1 v-if="authStore.isSignedIn">
      You are logged in!!!
    </h1>
    <h1 v-else>
      You are NOT logged in!!!
    </h1>
  </div>
</template>
