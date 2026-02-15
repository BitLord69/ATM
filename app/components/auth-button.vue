<script setup lang="ts">
import type { loginProviders } from "~/stores/auth";

import { useAuthStore } from "~/stores/auth";

type Props = {
  provider: loginProviders;
  icon: string;
};

const props = defineProps<Props>();
const authStore = useAuthStore();
</script>

<template>
  <button
    class="btn btn-accent"
    :disabled="authStore.loading"
    @click="authStore.signIn(props.provider)"
  >
    <span v-if="authStore.loading" class="loading-spinner mr-2" />
    <Icon
      v-else
      :name="props.icon"
      size="24"
    />
    <slot />
  </button>
</template>
