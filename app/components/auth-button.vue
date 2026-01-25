<script setup lang="ts">
import { createAuthClient } from "better-auth/client";

const props = defineProps<Props>();

const loading = ref(false);

const authClient = createAuthClient();

type Props = {
  provider: "email" | "github" | "google" | "facebook" | "apple" | "microsoft";
  icon: string;
};

async function signIn() {
  loading.value = true;

  await authClient.signIn.social({
    provider: props.provider,
    callbackURL: "/dashboard",
  });

  loading.value = false;
}
</script>

<template>
  <button
    class="btn btn-accent"

    :disabled="loading"
    @click="signIn"
  >
    <span v-if="loading" class="loading-spinner mr-2" />
    <Icon
      v-else
      :name="props.icon"
      size="24"
    />
    <slot />
  </button>
</template>
