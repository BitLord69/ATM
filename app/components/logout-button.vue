<script setup lang="ts">
import { useAuthClient, useAuthStore } from "~/stores/auth";

const route = useRoute();
const authClient = useAuthClient();
const authStore = useAuthStore();

const user = ref<{ email: string; name: string } | null>(null);
const isLoading = ref(false);

async function loadSession() {
  const session = await authClient.getSession();
  if (session?.data?.user) {
    user.value = {
      email: session.data.user.email,
      name: session.data.user.name || "User",
    };
  }
  else {
    user.value = null;
  }
}

async function handleLogout() {
  isLoading.value = true;
  await authStore.signOut();
  isLoading.value = false;
}

onMounted(() => {
  void loadSession();
});

// Re-check session when route changes (especially after logout redirect)
watch(() => route.path, () => {
  void loadSession();
});
</script>

<template>
  <div v-if="user" class="dropdown dropdown-end">
    <button
      type="button"
      tabindex="0"
      class="btn btn-ghost gap-2 normal-case"
    >
      <div class="avatar placeholder">
        <div class="bg-secondary text-secondary-content rounded-full w-8 flex items-center justify-center">
          <span class="text-sm font-bold">{{ user.name.charAt(0).toUpperCase() }}</span>
        </div>
      </div>
      <span class="hidden sm:inline">{{ user.email }}</span>
    </button>

    <ul
      tabindex="0"
      class="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52"
    >
      <li class="menu-title">
        <span>{{ user.email }}</span>
      </li>
      <li>
        <a href="/dashboard">Dashboard</a>
      </li>
      <li>
        <a href="/admin/invites">Send Invitations</a>
      </li>
      <li>
        <button :disabled="isLoading" @click="handleLogout">
          <span v-if="isLoading" class="loading loading-spinner loading-sm" />
          <span v-else>Log Out</span>
        </button>
      </li>
    </ul>
  </div>
</template>
