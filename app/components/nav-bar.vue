<script setup lang="ts">
import LogoutButton from "./logout-button.vue";
import ThemeToggle from "./theme-toggle.vue";

const authStore = useAuthStore();
const tournamentStore = useTournamentStore();
const authUiReady = ref(false);
const route = useRoute();
const adminMenuDetails = ref<HTMLDetailsElement | null>(null);

const TOURNAMENT_ADMIN_ROLES = new Set(["owner", "admin", "td"]);

const isGlobalAdmin = computed(() => authStore.currentUser?.role === "admin");

const hasTournamentAdminAccess = computed(() => {
  return tournamentStore.tournaments.some(
    t => t.status === "active" && TOURNAMENT_ADMIN_ROLES.has(t.role),
  );
});

const canAccessAdminMenu = computed(() => isGlobalAdmin.value || hasTournamentAdminAccess.value);

const canAccessTournamentWorkspace = computed(() => canAccessAdminMenu.value);

const canAccessUsersWorkspace = computed(() => canAccessAdminMenu.value);

onMounted(() => {
  authUiReady.value = true;
});

function closeAdminMenu() {
  if (adminMenuDetails.value?.open) {
    adminMenuDetails.value.open = false;
  }
}

watch(() => route.fullPath, closeAdminMenu);
</script>

<template>
  <div class="navbar bg-primary text-primary-content">
    <div class="navbar-start">
      <NuxtLink to="/" class="btn-outline">
        <img
          src="/logo-symbol.png"
          srcset="/logo-symbol-32.png 32w, /logo-symbol-64.png 64w, /logo-symbol-128.png 128w"
          sizes="(max-width: 640px) 24px, 40px"
          alt="Logo"
          class="w-6 sm:w-6 md:w-10 mr-2 inline-block prefers-dark-logo dark:invert dark:brightness-125"
        >
      </NuxtLink>
    </div>
    <div class="navbar-center hidden lg:flex">
      <ul class="menu menu-horizontal px-1 gap-1">
        <li>
          <NuxtLink
            to="/tournaments"
            class="btn btn-ghost"
          >
            Tournaments
          </NuxtLink>
        </li>
        <li v-if="authUiReady && authStore.isSignedIn">
          <NuxtLink
            to="/dashboard"
            class="btn btn-ghost"
          >
            My dashboard
          </NuxtLink>
        </li>
        <li v-if="authUiReady && authStore.isSignedIn && canAccessUsersWorkspace">
          <details ref="adminMenuDetails" class="group">
            <summary class="btn btn-ghost list-none after:hidden [&::-webkit-details-marker]:hidden">
              <span>Admin</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                class="size-4 ml-2 transition-transform duration-200 group-open:rotate-180"
                aria-hidden="true"
              >
                <path
                  fill-rule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.51a.75.75 0 01-1.08 0l-4.25-4.51a.75.75 0 01.02-1.06z"
                  clip-rule="evenodd"
                />
              </svg>
            </summary>
            <ul class="z-1 menu p-2 rounded-box w-52 bg-base-100 opacity-100 text-base-content border border-base-300 shadow-xl">
              <li v-if="canAccessTournamentWorkspace">
                <NuxtLink to="/dashboard/tournaments" @click="closeAdminMenu">
                  Tournament Workspace
                </NuxtLink>
              </li>
              <li v-if="canAccessUsersWorkspace">
                <NuxtLink to="/admin/users" @click="closeAdminMenu">
                  User Workspace
                </NuxtLink>
              </li>
              <li v-if="canAccessUsersWorkspace">
                <NuxtLink to="/admin/ban-requests" @click="closeAdminMenu">
                  Ban Requests
                </NuxtLink>
              </li>
            </ul>
          </details>
        </li>
      </ul>
    </div>
    <div class="navbar-end gap-2">
      <ThemeToggle />
      <LogoutButton v-if="authUiReady && authStore.isSignedIn" />
      <button
        v-else-if="authUiReady"
        class="btn btn-accent"
        :disabled="authStore.loading"
        @click="navigateTo('/signin')"
      >
        <span v-if="authStore.loading" class="loading loading-spinner loading-sm" />
        <span v-else>Sign in</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
/* Fallback for OS-level dark mode (for browsers without Tailwind `dark:` enabled) */
@media (prefers-color-scheme: dark) {
  .prefers-dark-logo {
    filter: invert(1) brightness(1.15);
  }
}
</style>
