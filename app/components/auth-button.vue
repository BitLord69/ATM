<script setup lang="ts">
import type { socialLoginProvider } from "~/stores/auth";

import { useAuthStore } from "~/stores/auth";

type Props = {
  provider: socialLoginProvider;
  icon: string;
};

const props = defineProps<Props>();
const authStore = useAuthStore();
const route = useRoute();
const redirectPath = computed(() => getSafeRedirectPath(route.query.redirect));
</script>

<template>
  <button
    class="btn btn-accent"
    :disabled="authStore.loading"
    @click="authStore.signInSocial(props.provider, redirectPath)"
  >
    <span v-if="authStore.loading" class="loading loading-spinner loading-sm" />
    <Icon
      v-else
      :name="props.icon"
      size="24"
    />
    <slot />
  </button>
</template>
