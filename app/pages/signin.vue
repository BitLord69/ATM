<script setup lang="ts">
import { useAuthStore } from "~/stores/auth";

definePageMeta({
  layout: "auth",
});

const authStore = useAuthStore();
const email = ref("");
const password = ref("");
const status = ref<{ type: "error"; message: string } | null>(null);
const resetStatus = ref<{ type: "success" | "error"; message: string } | null>(null);
const showEmailForm = ref(false);

async function handleEmailSignIn() {
  status.value = null;

  const normalizedEmail = email.value.trim().toLowerCase();
  if (!normalizedEmail || !password.value) {
    status.value = { type: "error", message: "Enter both email and password." };
    return;
  }

  const result = await authStore.signInEmail(normalizedEmail, password.value);
  if (!result.ok) {
    status.value = { type: "error", message: result.error || "Unable to sign in." };
    return;
  }

  await navigateTo("/dashboard");
}

async function handleForgotPassword() {
  console.warn("[signin] forgot password click");
  resetStatus.value = null;

  const normalizedEmail = email.value.trim().toLowerCase();
  if (!normalizedEmail) {
    resetStatus.value = { type: "error", message: "Enter your email first." };
    return;
  }

  const result = await authStore.requestPasswordReset(normalizedEmail);
  console.warn("[signin] forgot password result", result);
  if (!result.ok) {
    resetStatus.value = { type: "error", message: result.error || "Unable to send reset email." };
    return;
  }

  resetStatus.value = {
    type: "success",
    message: "Password reset email sent. Check your inbox.",
  };
}

function openEmailForm() {
  showEmailForm.value = true;
  status.value = null;
  resetStatus.value = null;
}

function backToOptions() {
  showEmailForm.value = false;
  password.value = "";
  status.value = null;
  resetStatus.value = null;
}
</script>

<template>
  <div class="max-w-sm mx-auto mt-20 px-4 flex flex-col gap-6">
    <div class="card bg-base-100 shadow-md border border-base-300">
      <div class="card-body gap-4">
        <h1 class="card-title text-2xl">
          Sign in
        </h1>

        <template v-if="!showEmailForm">
          <button class="btn btn-primary" @click="openEmailForm">
            Sign in with email
          </button>

          <div class="divider my-1">
            OR
          </div>

          <AuthButton provider="github" icon="tabler:brand-github">
            Sign in with GitHub
          </AuthButton>

          <AuthButton provider="google" icon="tabler:brand-google-filled">
            Sign in with Google
          </AuthButton>

          <AuthButton provider="facebook" icon="tabler:brand-facebook-filled">
            Sign in with Facebook
          </AuthButton>
        </template>

        <template v-else>
          <div
            v-if="status?.type === 'error'"
            class="alert alert-error"
            role="alert"
          >
            <span>{{ status.message }}</span>
          </div>

          <div class="form-control">
            <label class="label">
              <span class="label-text">Email</span>
            </label>
            <input
              v-model="email"
              type="email"
              autocomplete="email"
              class="input input-bordered"
              placeholder="you@example.com"
            >
          </div>

          <div class="form-control">
            <label class="label">
              <span class="label-text">Password</span>
            </label>
            <input
              v-model="password"
              type="password"
              autocomplete="current-password"
              class="input input-bordered"
              placeholder="Enter your password"
              @keydown.enter="handleEmailSignIn"
            >
          </div>

          <button
            class="btn btn-primary"
            :disabled="authStore.loading"
            @click="handleEmailSignIn"
          >
            <span v-if="authStore.loading" class="loading loading-spinner loading-sm" />
            <span v-else>Sign in with email</span>
          </button>

          <button
            class="btn btn-link px-0 self-start"
            :disabled="authStore.loading"
            @click="handleForgotPassword"
          >
            <span v-if="authStore.loading" class="loading loading-spinner loading-xs mr-2" />
            Forgot password?
          </button>

          <div
            v-if="resetStatus"
            :class="resetStatus.type === 'success' ? 'alert alert-success' : 'alert alert-error'"
            role="alert"
          >
            <span>{{ resetStatus.message }}</span>
          </div>

          <button class="btn btn-ghost" @click="backToOptions">
            Back to sign-in options
          </button>
        </template>
      </div>
    </div>
  </div>
</template>
