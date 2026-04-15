<script setup lang="ts">
definePageMeta({
  layout: "admin",
  ssr: false,
});

type BanRequestItem = {
  id: string;
  targetUserId: string;
  requestedByUserId: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  decisionNote: string | null;
  notifyByEmail: boolean;
  scopeTournamentIds: number[];
  decidedByUserId: string | null;
  decidedAt: number | null;
  createdAt: number;
  updatedAt: number;
  targetUser: { id: string; name: string; email: string } | null;
  requestedByUser: { id: string; name: string; email: string } | null;
  decidedByUser: { id: string; name: string; email: string } | null;
};

type BanRequestResponse = {
  items: BanRequestItem[];
  permissions: {
    canDecide: boolean;
    canCreate: boolean;
  };
};

const statusFilter = ref<"all" | "pending" | "approved" | "rejected">("pending");
const decisionModal = ref<BanRequestItem | null>(null);
const decision = ref<"approved" | "rejected">("approved");
const decisionNote = ref("");
const deciding = ref(false);
const statusMsg = ref<{ type: "success" | "error"; message: string } | null>(null);

const { data, pending, refresh } = await useFetch<BanRequestResponse>("/api/admin/ban-requests", {
  query: computed(() => ({
    status: statusFilter.value,
  })),
});

const canDecide = computed(() => data.value?.permissions.canDecide ?? false);
const items = computed(() => data.value?.items ?? []);

onMounted(async () => {
  try {
    await $fetch("/api/admin/notifications/mark-all-read", { method: "POST" });
  }
  catch {
    // Ignore; notification read state should not block page.
  }
});

function formatDate(ms: number | null | undefined) {
  if (!ms) {
    return "-";
  }
  return new Date(ms).toLocaleString();
}

function setStatus(type: "success" | "error", message: string) {
  statusMsg.value = { type, message };
  setTimeout(() => {
    statusMsg.value = null;
  }, 4000);
}

function openDecisionModal(item: BanRequestItem, nextDecision: "approved" | "rejected") {
  decisionModal.value = item;
  decision.value = nextDecision;
  decisionNote.value = "";
}

async function submitDecision() {
  if (!decisionModal.value || !canDecide.value) {
    return;
  }

  deciding.value = true;
  try {
    await $fetch(`/api/admin/ban-requests/${decisionModal.value.id}/decision`, {
      method: "PATCH",
      body: {
        decision: decision.value,
        note: decisionNote.value.trim() || undefined,
      },
    });
    setStatus("success", `Request ${decision.value}.`);
    decisionModal.value = null;
    await refresh();
  }
  catch (error: any) {
    setStatus("error", error?.data?.message ?? "Failed to submit decision.");
  }
  finally {
    deciding.value = false;
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <h2 class="text-lg font-semibold">
        Ban Requests
      </h2>
      <div class="tabs tabs-boxed">
        <button
          class="tab"
          :class="{ 'tab-active': statusFilter === 'pending' }"
          @click="statusFilter = 'pending'"
        >
          Pending
        </button>
        <button
          class="tab"
          :class="{ 'tab-active': statusFilter === 'approved' }"
          @click="statusFilter = 'approved'"
        >
          Approved
        </button>
        <button
          class="tab"
          :class="{ 'tab-active': statusFilter === 'rejected' }"
          @click="statusFilter = 'rejected'"
        >
          Rejected
        </button>
        <button
          class="tab"
          :class="{ 'tab-active': statusFilter === 'all' }"
          @click="statusFilter = 'all'"
        >
          All
        </button>
      </div>
    </div>

    <div class="alert alert-info shadow-sm">
      <span>
        Email notifications for ban requests are configured per tournament in Tournament Workspace settings.
      </span>
    </div>

    <div
      v-if="statusMsg"
      class="alert flex items-center justify-between shadow-sm"
      :class="statusMsg.type === 'success' ? 'alert-success' : 'alert-error'"
      role="alert"
    >
      <span>{{ statusMsg.message }}</span>
      <button class="btn btn-ghost btn-xs" @click="statusMsg = null">
        ✕
      </button>
    </div>

    <div v-if="pending" class="flex justify-center py-10">
      <span class="loading loading-spinner loading-lg" />
    </div>

    <div v-else-if="items.length === 0" class="text-center py-10 opacity-60">
      No ban requests found for this filter.
    </div>

    <div v-else class="overflow-x-auto rounded-box border border-base-300">
      <table class="table table-sm table-zebra">
        <thead>
          <tr>
            <th>Target user</th>
            <th>Requested by</th>
            <th>Reason</th>
            <th>Status</th>
            <th>Created</th>
            <th>Decision</th>
            <th v-if="canDecide">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in items" :key="item.id">
            <td>
              <div class="font-medium">
                {{ item.targetUser?.name || item.targetUser?.email || item.targetUserId }}
              </div>
              <div class="text-xs opacity-70">
                {{ item.targetUser?.email || '-' }}
              </div>
            </td>
            <td>
              <div class="font-medium">
                {{ item.requestedByUser?.name || item.requestedByUser?.email || item.requestedByUserId }}
              </div>
              <div class="text-xs opacity-70">
                {{ item.requestedByUser?.email || '-' }}
              </div>
            </td>
            <td class="max-w-xs">
              <p class="line-clamp-3">
                {{ item.reason }}
              </p>
              <p v-if="item.notifyByEmail" class="text-xs opacity-70 mt-1">
                Requested with email notifications.
              </p>
            </td>
            <td>
              <span
                class="badge badge-sm capitalize"
                :class="item.status === 'pending' ? 'badge-warning' : item.status === 'approved' ? 'badge-success' : 'badge-ghost'"
              >
                {{ item.status }}
              </span>
            </td>
            <td class="text-xs opacity-80">
              {{ formatDate(item.createdAt) }}
            </td>
            <td class="text-xs opacity-80">
              <span v-if="item.decidedAt">{{ formatDate(item.decidedAt) }}</span>
              <span v-else>-</span>
              <div v-if="item.decisionNote" class="mt-1 opacity-70">
                {{ item.decisionNote }}
              </div>
            </td>
            <td v-if="canDecide">
              <div v-if="item.status === 'pending'" class="flex items-center gap-1">
                <button class="btn btn-xs btn-success" @click="openDecisionModal(item, 'approved')">
                  Approve
                </button>
                <button class="btn btn-xs btn-error" @click="openDecisionModal(item, 'rejected')">
                  Reject
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <ConfirmationModal
      :open="!!decisionModal"
      :title="decision === 'approved' ? 'Approve ban request' : 'Reject ban request'"
      :confirm-text="decision === 'approved' ? 'Approve and Ban' : 'Reject request'"
      :is-dangerous="decision === 'approved'"
      :confirm-disabled="deciding"
      @confirm="submitDecision"
      @cancel="decisionModal = null"
    >
      <div v-if="decisionModal" class="space-y-3">
        <p class="text-sm opacity-80">
          {{ decision === 'approved'
            ? `This will ban ${decisionModal.targetUser?.email || decisionModal.targetUserId}.`
            : 'This request will be marked as rejected.' }}
        </p>

        <label class="form-control">
          <div class="label py-1">
            <span class="label-text">Decision note (optional)</span>
          </div>
          <textarea
            v-model="decisionNote"
            class="textarea textarea-bordered min-h-20"
            placeholder="Add context for the requester"
          />
        </label>
      </div>
    </ConfirmationModal>
  </div>
</template>
