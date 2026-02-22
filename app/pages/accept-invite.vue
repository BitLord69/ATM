<script setup lang="ts">
import { useAuthClient, useAuthStore } from "~/stores/auth";

const route = useRoute();
const authClient = useAuthClient();
const authStore = useAuthStore();

const invitationId = computed(() => {
  const id = route.query.id;
  if (typeof id === "string") {
    return id;
  }
  if (Array.isArray(id)) {
    return id[0] ?? "";
  }
  return "";
});

const isLoading = ref(true);
const isSubmitting = ref(false);
const status = ref<{ type: "success" | "error"; message: string } | null>(null);
const invitationDetails = ref<{ email: string; organizationName: string } | null>(null);
const currentUserEmail = ref<string | null>(null);
const accountExists = ref(false);
const wrongEmailLoggedIn = computed(() =>
  currentUserEmail.value && invitationDetails.value
  && currentUserEmail.value !== invitationDetails.value.email,
);

// Signup form state
const signupForm = ref({
  password: "",
  confirmPassword: "",
});

// Login form state
const loginForm = ref({
  password: "",
});

async function loadInvitation() {
  if (!invitationId.value) {
    status.value = { type: "error", message: "Missing invitation id." };
    isLoading.value = false;
    return;
  }

  try {
    const { data } = await $fetch(`/api/invitations/${invitationId.value}/details`);
    invitationDetails.value = data;

    // Check current session
    const sessionData = await authClient.getSession();
    if (sessionData?.data?.user) {
      currentUserEmail.value = sessionData.data.user.email;

      // Auto-accept if logged in with matching email
      if (sessionData.data.user.email === data.email) {
        await acceptInvite();
      }
    }
    else {
      // Check if account exists for this email
      const checkResponse = await $fetch("/api/users/check-email", {
        method: "POST",
        body: { email: data.email },
      });
      accountExists.value = checkResponse.exists;
    }
  }
  catch (error: any) {
    status.value = {
      type: "error",
      message: error?.data?.message || "Unable to load invitation.",
    };
  }
  finally {
    isLoading.value = false;
  }
}

async function handleSignup() {
  if (!invitationDetails.value) {
    status.value = { type: "error", message: "Missing invitation details." };
    return;
  }

  if (signupForm.value.password !== signupForm.value.confirmPassword) {
    status.value = { type: "error", message: "Passwords do not match." };
    return;
  }

  if (signupForm.value.password.length < 8) {
    status.value = { type: "error", message: "Password must be at least 8 characters." };
    return;
  }

  isSubmitting.value = true;
  status.value = null;

  try {
    const { error } = await authClient.signUp.email({
      email: invitationDetails.value.email,
      password: signupForm.value.password,
      name: invitationDetails.value.email.split("@")[0], // Use part before @ as name
    });

    if (error) {
      status.value = { type: "error", message: error.message ?? "Unable to create account." };
      isSubmitting.value = false;
      return;
    }

    // If signup successful, auto-accept the invitation
    await acceptInvite();
  }
  catch {
    status.value = { type: "error", message: "Unable to create account." };
    isSubmitting.value = false;
  }
}

async function handleLogin() {
  if (!invitationDetails.value) {
    status.value = { type: "error", message: "Missing invitation details." };
    return;
  }

  if (!loginForm.value.password) {
    status.value = { type: "error", message: "Please enter your password." };
    return;
  }

  isSubmitting.value = true;
  status.value = null;

  try {
    const { error } = await authClient.signIn.email({
      email: invitationDetails.value.email,
      password: loginForm.value.password,
    });

    if (error) {
      status.value = { type: "error", message: error.message ?? "Invalid email or password." };
      isSubmitting.value = false;
      return;
    }

    // If login successful, auto-accept the invitation
    await acceptInvite();
  }
  catch {
    status.value = { type: "error", message: "Login failed. Please try again." };
    isSubmitting.value = false;
  }
}

async function handleSocialSignup(provider: "github" | "google" | "facebook") {
  isSubmitting.value = true;
  status.value = null;

  await authClient.signIn.social({
    provider,
    callbackURL: `/accept-invite?id=${invitationId.value}`,
  });

  isSubmitting.value = false;
}

async function acceptInvite() {
  if (!invitationId.value) {
    status.value = { type: "error", message: "Missing invitation id." };
    return;
  }

  isSubmitting.value = true;
  status.value = null;

  const { data: _data, error } = await authClient.organization.acceptInvitation({
    invitationId: invitationId.value,
  });

  isSubmitting.value = false;

  if (error) {
    status.value = { type: "error", message: error.message ?? "Unable to accept invitation." };
    return;
  }

  status.value = {
    type: "success",
    message: `Welcome! You've been added to ${invitationDetails.value?.organizationName}. Redirecting...`,
  };

  // Redirect after 2 seconds
  setTimeout(() => {
    navigateTo("/dashboard");
  }, 2000);
}

async function handleLogout() {
  await authStore.signOut();
}

onMounted(() => {
  void loadInvitation();
});
</script>

<template>
  <div class="flex justify-center items-center min-h-screen bg-base-200 p-4">
    <div class="card w-full max-w-md bg-base-100 shadow-xl">
      <div class="card-body">
        <h2 class="card-title text-2xl font-bold mb-4">
          Accept Invitation
        </h2>

        <!-- Loading State -->
        <div v-if="isLoading" class="flex flex-col items-center gap-4">
          <span class="loading loading-spinner loading-lg" />
          <p class="text-sm opacity-70">
            Loading invitation details...
          </p>
        </div>

        <!-- Error State -->
        <div
          v-else-if="status?.type === 'error'"
          class="alert alert-error mb-4 shadow-sm"
          role="alert"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="stroke-current shrink-0 h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>{{ status.message }}</span>
        </div>

        <!-- Success State -->
        <div
          v-else-if="status?.type === 'success'"
          class="alert alert-success mb-4 shadow-sm"
          role="alert"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="stroke-current shrink-0 h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>{{ status.message }}</span>
        </div>

        <!-- Wrong Email Logged In -->
        <div v-else-if="wrongEmailLoggedIn" class="space-y-4">
          <div class="bg-warning/10 border border-warning rounded-lg p-4 space-y-2">
            <p class="text-sm font-semibold">
              Invitation For:
            </p>
            <p class="text-lg font-bold">
              {{ invitationDetails.email }}
            </p>
          </div>

          <div class="bg-error/10 border border-error rounded-lg p-4 space-y-2">
            <p class="text-sm font-semibold">
              Currently Logged In As:
            </p>
            <p class="text-lg font-bold">
              {{ currentUserEmail }}
            </p>
            <p class="text-xs opacity-70 mt-2">
              These emails don't match. Please log out and sign up with the correct email.
            </p>
          </div>

          <div class="divider my-2" />

          <button
            class="btn btn-error w-full"
            :disabled="authStore.loading"
            @click="handleLogout"
          >
            <span v-if="authStore.loading" class="loading loading-spinner" />
            <span v-else>Log Out</span>
          </button>
        </div>

        <!-- Login Form (Account Exists, Not Logged In) -->
        <div v-else-if="invitationDetails && !currentUserEmail && accountExists" class="space-y-4">
          <div class="bg-success/10 border border-success rounded-lg p-4 space-y-2">
            <p class="text-sm font-semibold">
              Welcome Back!
            </p>
            <p class="text-base font-bold">
              {{ invitationDetails.organizationName }}
            </p>
            <p class="text-xs opacity-70">
              You've been invited to join this tournament.
            </p>
          </div>

          <!-- Email Display -->
          <FormField label="Email">
            <input
              type="email"
              :value="invitationDetails.email"
              disabled
              class="input input-bordered bg-base-200"
            >
          </FormField>

          <!-- Password Input -->
          <FormField label="Password">
            <input
              v-model="loginForm.password"
              type="password"
              placeholder="Enter your password"
              class="input input-bordered"
            >
          </FormField>

          <!-- Login Button -->
          <button
            class="btn btn-primary w-full"
            :disabled="isSubmitting"
            @click="handleLogin"
          >
            <span v-if="isSubmitting" class="loading loading-spinner" />
            <span v-else>Log In & Accept Invitation</span>
          </button>
        </div>

        <!-- Signup Form (No Account, Not Logged In) -->
        <div v-else-if="invitationDetails && !currentUserEmail && !accountExists" class="space-y-4">
          <div class="bg-info/10 border border-info rounded-lg p-4 space-y-2">
            <p class="text-sm font-semibold">
              Get Started:
            </p>
            <p class="text-lg font-bold">
              {{ invitationDetails.organizationName }}
            </p>
          </div>

          <!-- Email Display -->
          <FormField
            label="Email"
            hint="This is the email the invitation was sent to, and cannot be changed."
          >
            <input
              type="email"
              :value="invitationDetails.email"
              disabled
              class="input input-bordered bg-base-200"
            >
          </FormField>

          <!-- Password Input -->
          <FormField label="Password">
            <input
              v-model="signupForm.password"
              type="password"
              placeholder="At least 8 characters"
              class="input input-bordered"
            >
          </FormField>

          <!-- Confirm password Input -->
          <FormField label="Confirm password">
            <input
              v-model="signupForm.confirmPassword"
              type="password"
              placeholder="Confirm your password"
              class="input input-bordered"
            >
          </FormField>

          <!-- Signup Button -->
          <button
            class="btn btn-primary w-full"
            :disabled="isSubmitting"
            @click="handleSignup"
          >
            <span v-if="isSubmitting" class="loading loading-spinner" />
            <span v-else>Create Account & Accept Invitation</span>
          </button>

          <!-- Divider -->
          <div class="divider">
            OR
          </div>

          <!-- Social Login Buttons -->
          <div class="space-y-2">
            <p class="text-sm text-center opacity-70">
              Sign up with your social account:
            </p>
            <button
              class="btn btn-outline w-full gap-2"
              :disabled="isSubmitting"
              @click="handleSocialSignup('github')"
            >
              <Icon name="mdi:github" size="20" />
              GitHub
            </button>
            <button
              class="btn btn-outline w-full gap-2"
              :disabled="isSubmitting"
              @click="handleSocialSignup('google')"
            >
              <Icon name="mdi:google" size="20" />
              Google
            </button>
          </div>
        </div>

        <!-- Ready to Accept (Logged In With Matching Email) -->
        <div v-else-if="invitationDetails && currentUserEmail && !wrongEmailLoggedIn" class="space-y-4">
          <div class="bg-info/10 border border-info rounded-lg p-4 space-y-2">
            <p class="text-sm font-semibold">
              Accepting Invitation To:
            </p>
            <p class="text-lg font-bold">
              {{ invitationDetails.organizationName }}
            </p>
            <p class="text-sm opacity-70">
              {{ invitationDetails.email }}
            </p>
          </div>

          <p class="text-sm opacity-70">
            Click below to accept this invitation and join the organization.
          </p>

          <button
            class="btn btn-primary w-full"
            :disabled="isSubmitting"
            @click="acceptInvite"
          >
            <span v-if="isSubmitting" class="loading loading-spinner" />
            <span v-else>Accept Invitation</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
