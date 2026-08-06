<script setup lang="ts">
import { useAuthClient } from "~/stores/auth";

definePageMeta({
  layout: "auth",
});

const route = useRoute();
const authClient = useAuthClient();

const password = ref("");
const confirmPassword = ref("");
const isSubmitting = ref(false);
const status = ref<{ type: "success" | "error"; message: string } | null>(null);

const token = computed(() => {
  const value = route.query.token;
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return "";
});

async function handleResetPassword() {
  status.value = null;

  if (!token.value) {
    status.value = { type: "error", message: "Missing reset token." };
    return;
  }

  if (!password.value || !confirmPassword.value) {
    status.value = { type: "error", message: "Enter and confirm your new password." };
    return;
  }

  if (password.value !== confirmPassword.value) {
    status.value = { type: "error", message: "Passwords do not match." };
    return;
  }

  if (password.value.length < 8) {
    status.value = { type: "error", message: "Password must be at least 8 characters." };
    return;
  }

  isSubmitting.value = true;

  try {
    const client = authClient as any;
    const response = await client.resetPassword({
      newPassword: password.value,
      token: token.value,
    });

    if (response?.error) {
      status.value = { type: "error", message: response.error.message || "Unable to reset password." };
      isSubmitting.value = false;
      return;
    }

    status.value = { type: "success", message: "Password reset successful. Redirecting to sign in..." };

    setTimeout(() => {
      navigateTo("/signin");
    }, 1500);
  }
  catch {
    status.value = { type: "error", message: "Unable to reset password." };
  }
  finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <div class="max-w-sm mx-auto mt-20 flex flex-col gap-6">
    <div class="card bg-base-100 shadow-md border border-base-300">
      <div class="card-body gap-4">
        <h1 class="card-title text-2xl">
          Reset password
        </h1>

        <div
          v-if="status"
          :class="status.type === 'success' ? 'alert alert-success' : 'alert alert-error'"
          role="alert"
        >
          <span>{{ status.message }}</span>
        </div>

        <div class="form-control">
          <label class="label">
            <span class="label-text">New password</span>
          </label>
          <input
            v-model="password"
            type="password"
            autocomplete="new-password"
            class="input input-bordered"
            placeholder="At least 8 characters"
          >
        </div>

        <div class="form-control">
          <label class="label">
            <span class="label-text">Confirm password</span>
          </label>
          <input
            v-model="confirmPassword"
            type="password"
            autocomplete="new-password"
            class="input input-bordered"
            placeholder="Confirm your new password"
            @keydown.enter="handleResetPassword"
          >
        </div>

        <button
          class="btn btn-primary"
          :disabled="isSubmitting"
          @click="handleResetPassword"
        >
          <span v-if="isSubmitting" class="loading loading-spinner loading-sm" />
          <span v-else>Set new password</span>
        </button>
      </div>
    </div>
  </div>
</template>
