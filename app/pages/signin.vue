<script setup lang="ts">
import { useAuthStore } from "~/stores/auth";

definePageMeta({
  layout: "auth",
});

const authStore = useAuthStore();
const route = useRoute();
const redirectPath = computed(() => getSafeRedirectPath(route.query.redirect) ?? "/dashboard");
const isCreatingTournamentFlow = computed(() => redirectPath.value === "/dashboard/tournaments/new");

const authMode = ref<"signin" | "signup">(route.query.mode === "signup" ? "signup" : "signin");
const fullName = ref("");
const email = ref("");
const password = ref("");
const status = ref<{ type: "error"; message: string } | null>(null);
const resetStatus = ref<{ type: "success" | "error"; message: string } | null>(null);
const showEmailForm = ref(route.query.mode === "signup");

function switchMode(mode: "signin" | "signup") {
  authMode.value = mode;
  status.value = null;
  resetStatus.value = null;
  if (mode === "signup") {
    showEmailForm.value = false;
  }
}

async function handleEmailSubmit() {
  status.value = null;

  const normalizedEmail = email.value.trim().toLowerCase();
  if (!normalizedEmail || !password.value) {
    status.value = { type: "error", message: "Enter both email and password." };
    return;
  }

  if (authMode.value === "signup") {
    const trimmedName = fullName.value.trim();
    if (trimmedName.length < 2) {
      status.value = { type: "error", message: "Enter your full name (at least 2 characters)." };
      return;
    }
    if (password.value.length < 8) {
      status.value = { type: "error", message: "Password must be at least 8 characters." };
      return;
    }

    const result = await authStore.signUpEmail(trimmedName, normalizedEmail, password.value);
    if (!result.ok) {
      status.value = { type: "error", message: result.error || "Unable to create account." };
      return;
    }

    await navigateTo(redirectPath.value);
    return;
  }

  const result = await authStore.signInEmail(normalizedEmail, password.value);
  if (!result.ok) {
    status.value = { type: "error", message: result.error || "Unable to sign in." };
    return;
  }

  await navigateTo(redirectPath.value);
}

async function handleForgotPassword() {
  resetStatus.value = null;

  const normalizedEmail = email.value.trim().toLowerCase();
  if (!normalizedEmail) {
    resetStatus.value = { type: "error", message: "Enter your email first." };
    return;
  }

  const result = await authStore.requestPasswordReset(normalizedEmail);
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
  <div class="max-w-sm mx-auto mt-16 px-4 flex flex-col gap-4">
    <div
      v-if="isCreatingTournamentFlow"
      class="alert alert-info shadow-sm"
    >
      <Icon
        name="tabler:trophy"
        size="22"
      />
      <div class="text-sm">
        <p class="font-semibold">
          Ready to host a tournament?
        </p>
        <p class="opacity-85">
          Create a free account or sign in first — you'll be taken straight to the tournament creation page right after.
        </p>
      </div>
    </div>

    <div class="card bg-base-100 shadow-md border border-base-300">
      <div class="card-body gap-4">
        <div
          role="tablist"
          class="tabs tabs-boxed grid grid-cols-2"
        >
          <button
            type="button"
            role="tab"
            class="tab"
            :class="{ 'tab-active': authMode === 'signin' }"
            @click="switchMode('signin')"
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            class="tab"
            :class="{ 'tab-active': authMode === 'signup' }"
            @click="switchMode('signup')"
          >
            Create account
          </button>
        </div>

        <h1 class="card-title text-2xl">
          {{ authMode === "signup" ? "Create an account" : "Sign in" }}
        </h1>

        <template v-if="!showEmailForm">
          <button
            type="button"
            class="btn btn-primary"
            @click="openEmailForm"
          >
            {{ authMode === "signup" ? "Sign up with email" : "Sign in with email" }}
          </button>

          <div class="divider my-1">
            OR
          </div>

          <AuthButton provider="github" icon="tabler:brand-github">
            {{ authMode === "signup" ? "Continue with GitHub" : "Sign in with GitHub" }}
          </AuthButton>

          <AuthButton provider="google" icon="tabler:brand-google-filled">
            {{ authMode === "signup" ? "Continue with Google" : "Sign in with Google" }}
          </AuthButton>

          <AuthButton provider="facebook" icon="tabler:brand-facebook-filled">
            {{ authMode === "signup" ? "Continue with Facebook" : "Sign in with Facebook" }}
          </AuthButton>
        </template>

        <form
          v-else
          class="flex flex-col gap-3"
          @submit.prevent="handleEmailSubmit"
        >
          <div
            v-if="status?.type === 'error'"
            class="alert alert-error"
            role="alert"
            aria-live="polite"
          >
            <span>{{ status.message }}</span>
          </div>

          <div
            v-if="authMode === 'signup'"
            class="flex flex-col gap-1"
          >
            <label
              for="auth-name"
              class="text-sm font-medium"
            >
              Full name <span aria-hidden="true">*</span>
            </label>
            <input
              id="auth-name"
              v-model="fullName"
              name="name"
              type="text"
              autocomplete="name"
              required
              class="input input-bordered w-full"
              placeholder="Your name"
            >
          </div>

          <div class="flex flex-col gap-1">
            <label
              for="auth-email"
              class="text-sm font-medium"
            >
              Email <span aria-hidden="true">*</span>
            </label>
            <input
              id="auth-email"
              v-model="email"
              name="email"
              type="email"
              autocomplete="email"
              autocorrect="off"
              autocapitalize="none"
              spellcheck="false"
              required
              class="input input-bordered w-full"
              placeholder="you@example.com"
            >
          </div>

          <div class="flex flex-col gap-1">
            <label
              for="auth-password"
              class="text-sm font-medium"
            >
              Password <span aria-hidden="true">*</span>
            </label>
            <input
              id="auth-password"
              v-model="password"
              name="password"
              type="password"
              :autocomplete="authMode === 'signup' ? 'new-password' : 'current-password'"
              :minlength="authMode === 'signup' ? 8 : undefined"
              required
              class="input input-bordered w-full"
              :placeholder="authMode === 'signup' ? 'At least 8 characters' : 'Enter your password'"
            >
          </div>

          <button
            type="submit"
            class="btn btn-primary mt-1"
            :disabled="authStore.loading"
          >
            <span
              v-if="authStore.loading"
              class="loading loading-spinner loading-sm"
            />
            <span v-else>{{ authMode === "signup" ? "Create account" : "Sign in with email" }}</span>
          </button>

          <button
            v-if="authMode === 'signin'"
            type="button"
            class="btn btn-link px-0 self-start"
            :disabled="authStore.loading"
            @click="handleForgotPassword"
          >
            Forgot password?
          </button>

          <div
            v-if="resetStatus"
            :class="resetStatus.type === 'success' ? 'alert alert-success' : 'alert alert-error'"
            role="status"
            aria-live="polite"
          >
            <span>{{ resetStatus.message }}</span>
          </div>

          <button
            type="button"
            class="btn btn-ghost"
            @click="backToOptions"
          >
            Back to {{ authMode === "signup" ? "sign-up" : "sign-in" }} options
          </button>
        </form>
      </div>
    </div>
  </div>
</template>
