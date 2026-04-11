<script setup lang="ts">
import type { PersistedUserRole } from "#shared/types/auth";

import { USER_ROLES } from "#shared/types/auth";

definePageMeta({
  layout: "admin",
  ssr: false,
});

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: PersistedUserRole;
  banned: boolean;
  bannedAt: number | null;
  banReason: string | null;
  forcePasswordChange: boolean;
  createdAt: number;
};

type UserSortBy = "createdAt" | "name" | "email" | "role";
type SortDir = "asc" | "desc";

type UsersResponse = {
  items: AdminUser[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  permissions: {
    canDeleteUsers: boolean;
    canBanUsers: boolean;
    canSendPasswordReset: boolean;
  };
  scope: {
    type: "admin" | "td";
    tournamentCount: number | null;
    tournaments: Array<{ id: number; name: string; slug: string }> | null;
  };
};

const search = ref("");
const debouncedSearch = ref("");
let searchTimer: ReturnType<typeof setTimeout> | null = null;

watch(search, (val) => {
  if (searchTimer) {
    clearTimeout(searchTimer);
  }

  searchTimer = setTimeout(() => {
    debouncedSearch.value = val;
  }, 300);
});

onBeforeUnmount(() => {
  if (searchTimer) {
    clearTimeout(searchTimer);
  }
});

const page = ref(1);
const pageSize = ref(25);
const roleFilter = ref<PersistedUserRole | "all">("all");
const statusFilter = ref<"all" | "active" | "banned">("all");
const sortBy = ref<UserSortBy>("email");
const sortDir = ref<SortDir>("asc");

watch([debouncedSearch, roleFilter, statusFilter, sortBy, sortDir, pageSize], () => {
  page.value = 1;
});

const { data, pending, refresh } = await useFetch<UsersResponse>("/api/admin/users", {
  query: computed(() => ({
    search: debouncedSearch.value || undefined,
    page: page.value,
    pageSize: pageSize.value,
    role: roleFilter.value,
    status: statusFilter.value,
    sortBy: sortBy.value,
    sortDir: sortDir.value,
  })),
});

const users = computed(() => data.value?.items ?? []);
const total = computed(() => data.value?.total ?? 0);
const totalPages = computed(() => data.value?.totalPages ?? 0);
const canBanUsers = computed(() => data.value?.permissions.canBanUsers ?? false);
const canDeleteUsers = computed(() => data.value?.permissions.canDeleteUsers ?? false);
const canSendPasswordReset = computed(() => data.value?.permissions.canSendPasswordReset ?? false);
const canManageUsers = computed(() => canBanUsers.value || canDeleteUsers.value || canSendPasswordReset.value);
const isTdScope = computed(() => data.value?.scope.type === "td");

// ── Action feedback ──────────────────────────────────────────────────────────
type StatusMsg = { type: "success" | "error"; message: string };
const status = ref<StatusMsg | null>(null);

function setStatus(type: "success" | "error", message: string) {
  status.value = { type, message };
  setTimeout(() => {
    status.value = null;
  }, 5000);
}

// ── Ban modal ────────────────────────────────────────────────────────────────
const banModal = ref<{ user: AdminUser; banning: boolean } | null>(null);
const banReason = ref("");

function openBanModal(u: AdminUser) {
  banModal.value = { user: u, banning: !u.banned };
  banReason.value = "";
}

async function confirmBan() {
  if (!banModal.value) {
    return;
  }

  const { user: u, banning } = banModal.value;
  try {
    await $fetch(`/api/admin/users/${u.id}/ban`, {
      method: "PATCH",
      body: { banned: banning, reason: banReason.value || undefined },
    });
    setStatus("success", banning ? `${u.email} has been banned.` : `${u.email} has been unbanned.`);
    await refresh();
  }
  catch (err: any) {
    setStatus("error", err?.data?.message ?? "An error occurred.");
  }
  finally {
    banModal.value = null;
  }
}

// ── Delete modal ─────────────────────────────────────────────────────────────
const deleteTarget = ref<AdminUser | null>(null);
const isDeleting = ref(false);

async function confirmDelete() {
  if (!deleteTarget.value) {
    return;
  }

  isDeleting.value = true;
  try {
    await $fetch(`/api/admin/users/${deleteTarget.value.id}`, { method: "DELETE" });
    setStatus("success", `${deleteTarget.value.email} has been deleted.`);
    await refresh();
  }
  catch (err: any) {
    setStatus("error", err?.data?.message ?? "An error occurred.");
  }
  finally {
    isDeleting.value = false;
    deleteTarget.value = null;
  }
}

// ── Password reset ───────────────────────────────────────────────────────────
const resettingId = ref<string | null>(null);

async function sendPasswordReset(u: AdminUser) {
  if (!canSendPasswordReset.value) {
    return;
  }

  resettingId.value = u.id;
  try {
    await $fetch(`/api/admin/users/${u.id}/send-reset`, { method: "POST" });
    setStatus("success", `Password reset email sent to ${u.email}.`);
  }
  catch (err: any) {
    setStatus("error", err?.data?.message ?? "Failed to send reset email.");
  }
  finally {
    resettingId.value = null;
  }
}

function formatDate(ms: number | null | undefined) {
  if (!ms) {
    return "–";
  }

  return new Date(ms).toLocaleDateString(undefined, { dateStyle: "medium" });
}

function goToPage(nextPage: number) {
  if (nextPage < 1 || nextPage > totalPages.value) {
    return;
  }

  page.value = nextPage;
}

function userDetailsPath(userId: string) {
  return `/admin/users/${encodeURIComponent(userId)}`;
}

function toggleSort(column: UserSortBy) {
  if (sortBy.value === column) {
    sortDir.value = sortDir.value === "asc" ? "desc" : "asc";
    return;
  }

  sortBy.value = column;
  sortDir.value = column === "createdAt" ? "desc" : "asc";
}

function sortIndicator(column: UserSortBy) {
  if (sortBy.value !== column) {
    return "↕";
  }

  return sortDir.value === "asc" ? "▲" : "▼";
}

function isActiveSortColumn(column: UserSortBy) {
  return sortBy.value === column;
}

function sortHeaderClass(column: UserSortBy) {
  return isActiveSortColumn(column)
    ? "text-primary bg-base-200/70"
    : "text-base-content/90";
}

function sortGlyphClass(column: UserSortBy) {
  return isActiveSortColumn(column)
    ? "text-primary"
    : "opacity-60";
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <h2 class="text-lg font-semibold">
        Users
      </h2>
      <div class="badge badge-outline">
        {{ total }} total
      </div>
    </div>

    <div
      v-if="isTdScope"
      class="alert alert-info shadow-sm"
      role="status"
    >
      <span>
        You can only see users from tournaments where you are a TD
        <template v-if="data?.scope.tournamentCount">({{ data.scope.tournamentCount }} tournaments)</template>.
      </span>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-6 gap-3">
      <label class="form-control md:col-span-2">
        <div class="label py-1">
          <span class="label-text text-xs">Search</span>
        </div>
        <input
          v-model="search"
          type="search"
          placeholder="Name or email"
          class="input input-bordered input-sm w-full"
        >
      </label>

      <label class="form-control">
        <div class="label py-1">
          <span class="label-text text-xs">Global role (system-wide)</span>
        </div>
        <select v-model="roleFilter" class="select select-bordered select-sm w-full bg-base-100 text-base-content border-base-300 hover:border-base-content/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20">
          <option value="all">
            All roles
          </option>
          <option
            v-for="r in USER_ROLES"
            :key="r"
            :value="r"
          >
            {{ r }}
          </option>
        </select>
      </label>

      <label class="form-control">
        <div class="label py-1">
          <span class="label-text text-xs">Status</span>
        </div>
        <select v-model="statusFilter" class="select select-bordered select-sm w-full bg-base-100 text-base-content border-base-300 hover:border-base-content/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20">
          <option value="all">
            All
          </option>
          <option value="active">
            Active
          </option>
          <option value="banned">
            Banned
          </option>
        </select>
      </label>

      <label class="form-control">
        <div class="label py-1">
          <span class="label-text text-xs">Sort by</span>
        </div>
        <select v-model="sortBy" class="select select-bordered select-sm w-full bg-base-100 text-base-content border-base-300 hover:border-base-content/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20">
          <option value="createdAt">
            Joined date
          </option>
          <option value="name">
            Name
          </option>
          <option value="email">
            Email
          </option>
          <option value="role">
            Role
          </option>
        </select>
      </label>

      <label class="form-control">
        <div class="label py-1">
          <span class="label-text text-xs">Direction</span>
        </div>
        <select v-model="sortDir" class="select select-bordered select-sm w-full bg-base-100 text-base-content border-base-300 hover:border-base-content/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20">
          <option value="desc">
            Desc
          </option>
          <option value="asc">
            Asc
          </option>
        </select>
      </label>
    </div>

    <!-- Status alert -->
    <div
      v-if="status"
      class="alert flex items-center justify-between shadow-sm"
      :class="status.type === 'success' ? 'alert-success' : 'alert-error'"
      role="alert"
    >
      <span>{{ status.message }}</span>
      <button class="btn btn-ghost btn-xs" @click="status = null">
        ✕
      </button>
    </div>

    <div class="text-xs opacity-70">
      Role column shows system-wide role. Per-tournament roles are available in each user's details page.
    </div>

    <!-- Loading -->
    <div v-if="pending" class="flex justify-center py-10">
      <span class="loading loading-spinner loading-lg" />
    </div>

    <!-- Empty state -->
    <div v-else-if="users.length === 0" class="text-center py-10 opacity-60">
      No users found.
    </div>

    <!-- Users table -->
    <div v-else class="overflow-x-auto rounded-box border border-base-300">
      <table class="table table-sm table-zebra">
        <thead>
          <tr>
            <th>
              <button
                class="btn btn-ghost btn-xs w-full justify-between normal-case"
                :class="sortHeaderClass('name')"
                @click="toggleSort('name')"
              >
                <span>Name</span>
                <span class="ml-2" :class="sortGlyphClass('name')">{{ sortIndicator("name") }}</span>
              </button>
            </th>
            <th>
              <button
                class="btn btn-ghost btn-xs w-full justify-between normal-case"
                :class="sortHeaderClass('email')"
                @click="toggleSort('email')"
              >
                <span>Email</span>
                <span class="ml-2" :class="sortGlyphClass('email')">{{ sortIndicator("email") }}</span>
              </button>
            </th>
            <th>
              <button
                class="btn btn-ghost btn-xs w-full justify-between normal-case"
                :class="sortHeaderClass('role')"
                @click="toggleSort('role')"
              >
                <span>Global role</span>
                <span class="ml-2" :class="sortGlyphClass('role')">{{ sortIndicator("role") }}</span>
              </button>
            </th>
            <th>Status</th>
            <th>
              <button
                class="btn btn-ghost btn-xs w-full justify-between normal-case"
                :class="sortHeaderClass('createdAt')"
                @click="toggleSort('createdAt')"
              >
                <span>Joined</span>
                <span class="ml-2" :class="sortGlyphClass('createdAt')">{{ sortIndicator("createdAt") }}</span>
              </button>
            </th>
            <th v-if="canManageUsers" class="text-right">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in users" :key="u.id">
            <td class="font-medium">
              <NuxtLink :to="userDetailsPath(u.id)" class="link link-hover">
                {{ u.name }}
              </NuxtLink>
            </td>
            <td class="text-sm opacity-80">
              {{ u.email }}
            </td>
            <td>
              <span class="badge badge-ghost badge-sm capitalize">{{ u.role }}</span>
            </td>
            <td>
              <span
                class="badge badge-sm"
                :class="u.banned ? 'badge-error' : 'badge-success'"
              >
                {{ u.banned ? 'Banned' : 'Active' }}
              </span>
            </td>
            <td class="text-sm opacity-70">
              {{ formatDate(u.createdAt) }}
            </td>
            <td v-if="canManageUsers" class="text-right">
              <div class="flex items-center justify-end gap-1 flex-wrap">
                <button
                  v-if="canSendPasswordReset"
                  class="btn btn-ghost btn-xs"
                  title="Send password reset email"
                  :disabled="resettingId === u.id"
                  @click="sendPasswordReset(u)"
                >
                  <span v-if="resettingId === u.id" class="loading loading-spinner loading-xs" />
                  <span v-else>Reset pw</span>
                </button>
                <button
                  v-if="canBanUsers"
                  class="btn btn-ghost btn-xs"
                  :class="u.banned ? 'text-success' : 'text-warning'"
                  @click="openBanModal(u)"
                >
                  {{ u.banned ? 'Unban' : 'Ban' }}
                </button>
                <button
                  v-if="canDeleteUsers"
                  class="btn btn-ghost btn-xs text-error"
                  @click="deleteTarget = u"
                >
                  Delete
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="flex items-center justify-between gap-3 flex-wrap">
      <label class="form-control">
        <div class="label py-1">
          <span class="label-text text-xs">Rows per page</span>
        </div>
        <select v-model.number="pageSize" class="select select-bordered select-sm w-28 bg-base-100 text-base-content border-base-300 hover:border-base-content/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20">
          <option :value="25">
            25
          </option>
          <option :value="50">
            50
          </option>
          <option :value="100">
            100
          </option>
        </select>
      </label>

      <div class="join">
        <button
          class="btn btn-sm join-item"
          :disabled="page <= 1"
          @click="goToPage(page - 1)"
        >
          Prev
        </button>
        <button class="btn btn-sm join-item btn-ghost pointer-events-none">
          Page {{ data?.page ?? 1 }} / {{ totalPages || 1 }}
        </button>
        <button
          class="btn btn-sm join-item"
          :disabled="page >= totalPages"
          @click="goToPage(page + 1)"
        >
          Next
        </button>
      </div>
    </div>

    <!-- Ban / Unban modal -->
    <dialog
      class="modal"
      :class="{ 'modal-open': !!banModal }"
    >
      <div v-if="banModal" class="modal-box">
        <h3 class="font-bold text-lg mb-3">
          {{ banModal.banning ? 'Ban user' : 'Unban user' }}
        </h3>
        <p class="mb-4 opacity-80">
          {{ banModal.banning
            ? `This will prevent ${banModal.user.email} from signing in.`
            : `This will allow ${banModal.user.email} to sign in again.` }}
        </p>
        <div v-if="banModal.banning" class="form-control mb-4">
          <label class="label">
            <span class="label-text">Reason (optional)</span>
          </label>
          <input
            v-model="banReason"
            type="text"
            placeholder="e.g. Violated terms of service"
            class="input input-bordered w-full"
          >
        </div>
        <div v-else-if="banModal.user.banReason" class="mb-4 text-sm opacity-70">
          Ban reason: {{ banModal.user.banReason }}
        </div>
        <div class="modal-action">
          <button class="btn btn-ghost" @click="banModal = null">
            Cancel
          </button>
          <button
            :class="banModal.banning ? 'btn btn-error' : 'btn btn-success'"
            @click="confirmBan"
          >
            {{ banModal.banning ? 'Ban' : 'Unban' }}
          </button>
        </div>
      </div>
      <div class="modal-backdrop" @click="banModal = null" />
    </dialog>

    <!-- Delete confirmation modal -->
    <ConfirmationModal
      :open="!!deleteTarget"
      title="Delete user"
      :message="deleteTarget ? `Permanently delete ${deleteTarget.email}? This cannot be undone.` : ''"
      confirm-text="Delete"
      :is-dangerous="true"
      @confirm="confirmDelete"
      @cancel="deleteTarget = null"
    />
  </div>
</template>
