<script setup lang="ts">
definePageMeta({
  layout: "admin",
  ssr: false,
});

type InvitationRow = {
  id: string;
  email: string;
  status: string;
  expiresAt: number;
  emailSentAt: number | null;
  emailError: string | null;
  createdAt: number;
  organizationId: string;
  organizationName: string | null;
  inviterId: string | null;
  isExpired: boolean;
  inviter: { id: string; name: string; email: string } | null;
};

const statusFilter = ref<"all" | "pending" | "expired">("pending");
const { data: invitations, pending, refresh } = await useFetch<InvitationRow[]>("/api/admin/invitations", {
  query: computed(() => ({ status: statusFilter.value })),
});

type StatusMsg = { type: "success" | "error"; message: string };
const status = ref<StatusMsg | null>(null);

function setStatus(type: "success" | "error", message: string) {
  status.value = { type, message };
  setTimeout(() => {
    status.value = null;
  }, 5000);
}

const resendingId = ref<string | null>(null);

async function resend(inv: InvitationRow) {
  resendingId.value = inv.id;
  try {
    await $fetch(`/api/invitations/${inv.id}/resend`, { method: "POST" });
    setStatus("success", `Invitation resent to ${inv.email}.`);
    await refresh();
  }
  catch (err: any) {
    setStatus("error", err?.data?.message ?? "Failed to resend invitation.");
  }
  finally {
    resendingId.value = null;
  }
}

function formatDate(ms: number | null | undefined) {
  if (!ms)
    return "–";
  return new Date(ms).toLocaleDateString(undefined, { dateStyle: "medium" });
}

function statusBadgeClass(inv: InvitationRow) {
  if (inv.status === "accepted")
    return "badge-success";
  if (inv.isExpired)
    return "badge-error";
  return "badge-warning";
}

function statusLabel(inv: InvitationRow) {
  if (inv.status === "accepted")
    return "Accepted";
  if (inv.isExpired)
    return "Expired";
  return "Pending";
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <h2 class="text-lg font-semibold">
        Invitations
      </h2>
      <div class="join">
        <button
          v-for="opt in (['pending', 'all', 'expired'] as const)"
          :key="opt"
          class="join-item btn btn-sm"
          :class="statusFilter === opt ? 'btn-primary' : 'btn-ghost'"
          @click="statusFilter = opt"
        >
          {{ opt.charAt(0).toUpperCase() + opt.slice(1) }}
        </button>
      </div>
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

    <!-- Loading -->
    <div v-if="pending" class="flex justify-center py-10">
      <span class="loading loading-spinner loading-lg" />
    </div>

    <!-- Empty state -->
    <div v-else-if="!invitations || invitations.length === 0" class="text-center py-10 opacity-60">
      No invitations found.
    </div>

    <!-- Invitations table -->
    <div v-else class="overflow-x-auto rounded-box border border-base-300">
      <table class="table table-sm table-zebra">
        <thead>
          <tr>
            <th>Email</th>
            <th>Tournament</th>
            <th>Status</th>
            <th>Sent</th>
            <th>Expires</th>
            <th>Invited by</th>
            <th class="text-right">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="inv in invitations" :key="inv.id">
            <td class="font-medium text-sm">
              {{ inv.email }}
            </td>
            <td class="text-sm opacity-80">
              {{ inv.organizationName ?? inv.organizationId }}
            </td>
            <td>
              <span
                class="badge badge-sm"
                :class="statusBadgeClass(inv)"
              >
                {{ statusLabel(inv) }}
              </span>
              <span
                v-if="inv.emailError"
                class="ml-1 badge badge-xs badge-error"
                :title="inv.emailError"
              >
                email failed
              </span>
            </td>
            <td class="text-sm opacity-70">
              {{ formatDate(inv.emailSentAt) }}
            </td>
            <td class="text-sm opacity-70">
              {{ formatDate(inv.expiresAt) }}
            </td>
            <td class="text-sm opacity-70">
              {{ inv.inviter?.name ?? inv.inviter?.email ?? '–' }}
            </td>
            <td class="text-right">
              <button
                v-if="inv.status === 'pending'"
                class="btn btn-ghost btn-xs"
                :disabled="resendingId === inv.id"
                @click="resend(inv)"
              >
                <span v-if="resendingId === inv.id" class="loading loading-spinner loading-xs" />
                <span v-else>Resend</span>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="flex justify-end">
      <NuxtLink to="/admin/invites" class="btn btn-primary btn-sm">
        + Send New Invite
      </NuxtLink>
    </div>
  </div>
</template>
