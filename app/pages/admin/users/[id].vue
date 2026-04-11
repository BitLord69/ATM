<script setup lang="ts">
import type { PersistedUserRole } from "#shared/types/auth";
import type { VerticalTabConfig } from "~/components/vertical-tabs-layout.vue";

definePageMeta({
  layout: "admin",
  ssr: false,
});

type UserConnection = {
  tournamentId: number;
  tournamentName: string;
  tournamentSlug: string;
  startDate: number | null;
  endDate: number | null;
  roles: string[];
  membershipStatuses: string[];
  hasPlayerEntry: boolean;
  playerEntryCount: number;
};

type UserDetailsResponse = {
  user: {
    id: string;
    name: string;
    email: string;
    role: PersistedUserRole;
    banned: boolean;
    createdAt: number;
  };
  connections: UserConnection[];
  summary: {
    tournamentCount: number;
    connectedAsPlayerCount: number;
    allRoles: string[];
  };
  scope: {
    type: "admin" | "td";
    tournamentIds: number[] | null;
  };
};

const route = useRoute();
const userId = computed(() => decodeURIComponent(String(route.params.id || "")));

const tabs: VerticalTabConfig[] = [
  { id: "profile", label: "Profile" },
  { id: "tournaments", label: "Tournaments & Roles" },
];

const activeTab = ref("profile");

const { data, pending, error } = await useFetch<UserDetailsResponse>(
  () => `/api/admin/users/${userId.value}`,
  { watch: [userId] },
);

function formatDate(ms: number | null | undefined) {
  if (!ms) {
    return "-";
  }

  return new Date(ms).toLocaleDateString(undefined, { dateStyle: "medium" });
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <h2 class="text-lg font-semibold">
        User Details
      </h2>
      <NuxtLink to="/admin/users" class="btn btn-sm btn-ghost">
        Back to users
      </NuxtLink>
    </div>

    <div v-if="pending" class="flex justify-center py-10">
      <span class="loading loading-spinner loading-lg" />
    </div>

    <div
      v-else-if="error"
      class="alert alert-error"
      role="alert"
    >
      <span>{{ (error as any)?.data?.message || "Failed to load user details." }}</span>
    </div>

    <template v-else-if="data">
      <VerticalTabsLayout
        v-model="activeTab"
        :tabs="tabs"
        session-state-key="admin-user-details"
      >
        <template #profile>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="rounded-box border border-base-300 p-4 space-y-2">
              <div class="text-sm opacity-70">
                Name
              </div>
              <div class="font-medium">
                {{ data.user.name }}
              </div>

              <div class="text-sm opacity-70 mt-3">
                Email
              </div>
              <div class="font-medium">
                {{ data.user.email }}
              </div>

              <div class="text-sm opacity-70 mt-3">
                Global role
              </div>
              <div>
                <span class="badge badge-ghost badge-sm capitalize">{{ data.user.role }}</span>
              </div>
            </div>

            <div class="rounded-box border border-base-300 p-4 space-y-2">
              <div class="text-sm opacity-70">
                Status
              </div>
              <div>
                <span class="badge badge-sm" :class="data.user.banned ? 'badge-error' : 'badge-success'">
                  {{ data.user.banned ? 'Banned' : 'Active' }}
                </span>
              </div>

              <div class="text-sm opacity-70 mt-3">
                Joined
              </div>
              <div class="font-medium">
                {{ formatDate(data.user.createdAt) }}
              </div>

              <div class="text-sm opacity-70 mt-3">
                Connected tournaments
              </div>
              <div class="font-medium">
                {{ data.summary.tournamentCount }}
              </div>
            </div>
          </div>
        </template>

        <template #tournaments>
          <div v-if="data.connections.length === 0" class="text-sm opacity-70 py-2">
            This user is not connected to any tournaments.
          </div>

          <div v-else class="overflow-x-auto rounded-box border border-base-300">
            <table class="table table-sm table-zebra">
              <thead>
                <tr>
                  <th>Tournament</th>
                  <th>Roles</th>
                  <th>Membership status</th>
                  <th>Player entries</th>
                  <th>Dates</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="connection in data.connections" :key="connection.tournamentId">
                  <td>
                    <div class="font-medium">
                      {{ connection.tournamentName }}
                    </div>
                    <div class="text-xs opacity-70">
                      /tournaments/{{ connection.tournamentSlug }}
                    </div>
                  </td>
                  <td>
                    <div class="flex flex-wrap gap-1">
                      <span
                        v-for="role in connection.roles"
                        :key="`${connection.tournamentId}-${role}`"
                        class="badge badge-ghost badge-sm capitalize"
                      >
                        {{ role }}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div v-if="connection.membershipStatuses.length > 0" class="flex flex-wrap gap-1">
                      <span
                        v-for="status in connection.membershipStatuses"
                        :key="`${connection.tournamentId}-status-${status}`"
                        class="badge badge-outline badge-sm"
                      >
                        {{ status }}
                      </span>
                    </div>
                    <span v-else class="text-xs opacity-60">No membership row</span>
                  </td>
                  <td>
                    <span class="badge badge-sm" :class="connection.hasPlayerEntry ? 'badge-primary' : 'badge-ghost'">
                      {{ connection.playerEntryCount }}
                    </span>
                  </td>
                  <td class="text-xs opacity-80">
                    {{ formatDate(connection.startDate) }} - {{ formatDate(connection.endDate) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </VerticalTabsLayout>
    </template>
  </div>
</template>
