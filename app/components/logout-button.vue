<script setup lang="ts">
import { useAuthStore } from "~/stores/auth";

const authStore = useAuthStore();
const tournamentStore = useTournamentStore();
const user = computed(() => authStore.currentUser);
const TOURNAMENT_ADMIN_ROLES = new Set(["owner", "admin", "td"]);
const unreadCount = ref(0);
let unreadTimer: ReturnType<typeof setInterval> | null = null;

const canAccessUsersWorkspace = computed(() => {
  const role = user.value?.role;
  if (role === "admin") {
    return true;
  }
  return tournamentStore.tournaments.some(t => t.status === "active" && TOURNAMENT_ADMIN_ROLES.has(t.role));
});

async function refreshUnreadCount() {
  if (!authStore.isSignedIn || !canAccessUsersWorkspace.value) {
    unreadCount.value = 0;
    return;
  }

  try {
    const response = await $fetch<{ unreadCount: number }>("/api/admin/notifications/unread-count");
    unreadCount.value = Math.max(0, Number(response.unreadCount || 0));
  }
  catch {
    unreadCount.value = 0;
  }
}

onMounted(async () => {
  await refreshUnreadCount();
  unreadTimer = setInterval(refreshUnreadCount, 30_000);
});

onBeforeUnmount(() => {
  if (unreadTimer) {
    clearInterval(unreadTimer);
  }
});

async function handleLogout() {
  await authStore.signOut();
}
</script>

<template>
  <div v-if="user" class="dropdown dropdown-end">
    <button
      type="button"
      tabindex="0"
      class="btn btn-ghost gap-2 normal-case relative"
    >
      <div class="avatar placeholder">
        <div class="bg-secondary text-secondary-content rounded-full w-8 flex items-center justify-center">
          <span class="text-sm font-bold">{{ user.name.charAt(0).toUpperCase() }}</span>
        </div>
      </div>
      <span
        v-if="unreadCount > 0"
        class="badge badge-error badge-xs absolute -top-1 -right-1 min-w-4 h-4 px-1"
      >
        {{ unreadCount > 9 ? '9+' : unreadCount }}
      </span>
      <span class="hidden sm:inline">{{ user.email }}</span>
    </button>

    <ul
      tabindex="0"
      class="dropdown-content z-1 menu p-2 rounded-box w-52 bg-base-100 text-base-content border border-base-300 shadow-xl"
    >
      <li class="menu-title">
        <span>{{ user.email }}</span>
      </li>
      <li>
        <NuxtLink to="/dashboard">
          My dashboard
        </NuxtLink>
      </li>
      <li v-if="canAccessUsersWorkspace">
        <NuxtLink to="/admin/users">
          User Workspace
        </NuxtLink>
      </li>
      <li v-if="canAccessUsersWorkspace">
        <NuxtLink to="/admin/ban-requests">
          Notifications
          <span v-if="unreadCount > 0" class="badge badge-error badge-xs">{{ unreadCount }}</span>
        </NuxtLink>
      </li>
      <li>
        <NuxtLink to="/admin/invites">
          Send Invitations
        </NuxtLink>
      </li>
      <li>
        <button :disabled="authStore.loading" @click="handleLogout">
          <span v-if="authStore.loading" class="loading loading-spinner loading-sm" />
          <span v-else>Log Out</span>
        </button>
      </li>
    </ul>
  </div>
</template>
