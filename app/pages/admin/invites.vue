<script setup lang="ts">
import type { UserRole } from "#shared/types/auth";

import { USER_ROLES } from "#shared/types/auth";
import { useAuthClient } from "~/stores/auth";

const authClient = useAuthClient();
const email = ref("");
const role = ref<UserRole>("guest");
const selectedOrganizations = ref<string[]>([]);
const orgRole = computed<"admin" | "member" | "owner">(() => {
  // Adjust this mapping if you want different org role rules.
  if (role.value === "admin") {
    return "admin";
  }
  return "member";
});
const isSubmitting = ref(false);
const status = ref<{ type: "success" | "error"; message: string } | null>(null);

// Auto-dismiss success messages after 5 seconds
watch(() => status.value, (newStatus) => {
  if (newStatus?.type === "success") {
    const timeout = setTimeout(() => {
      status.value = null;
    }, 5000);
    onBeforeUnmount(() => clearTimeout(timeout));
  }
});

function dismissStatus() {
  status.value = null;
}

// Modal state for resend confirmation
const showConfirmModal = ref(false);
const confirmData = ref<{
  email: string;
  existingOrgs: string[];
  newOrgsCount: number;
  existingChecks: Array<{ orgId: string; orgName: string; invitation: any }>;
  newOrganizations: string[];
} | null>(null);

let confirmResolve: ((value: boolean) => void) | null = null;

function showConfirmDialog(data: any) {
  confirmData.value = data;
  showConfirmModal.value = true;
  return new Promise<boolean>((resolve) => {
    confirmResolve = resolve;
  });
}

function confirmYes() {
  showConfirmModal.value = false;
  confirmResolve?.(true);
}

function confirmNo() {
  showConfirmModal.value = false;
  confirmResolve?.(false);
}

// Fetch organizations
const { data: organizations, pending } = await useFetch("/api/organizations");

async function handleInvite() {
  if (selectedOrganizations.value.length === 0) {
    status.value = { type: "error", message: "Please select at least one tournament." };
    return;
  }

  isSubmitting.value = true;
  status.value = null;

  // First, check for existing invitations
  const existingChecks = [];
  const newOrganizations = [];

  for (const orgId of selectedOrganizations.value) {
    const check = await $fetch("/api/invitations/check", {
      method: "POST",
      body: { email: email.value, organizationId: orgId },
    });
    if (check.exists) {
      const org = organizations.value?.find((o: any) => o.id === orgId);
      existingChecks.push({ orgId, orgName: org?.name || orgId, invitation: check.invitation });
    }
    else {
      newOrganizations.push(orgId);
    }
  }

  const results: Array<{ org: string; success: boolean; error?: string }> = [];

  // If any existing invitations, ask user if they want to resend
  if (existingChecks.length > 0) {
    const orgNames = existingChecks.map(c => c.orgName);
    const shouldResend = await showConfirmDialog({
      email: email.value,
      existingOrgs: orgNames,
      newOrgsCount: newOrganizations.length,
      existingChecks,
      newOrganizations,
    });

    if (!shouldResend) {
      isSubmitting.value = false;
      return;
    }

    // Resend existing invitations
    for (const { orgName, invitation } of existingChecks) {
      try {
        await $fetch(`/api/invitations/${invitation.id}/resend`, { method: "POST" });
        results.push({ org: orgName, success: true });
      }
      catch (error: any) {
        results.push({ org: orgName, success: false, error: error.message });
      }
    }
  }

  // Send invitations for NEW organizations
  for (const orgId of newOrganizations) {
    const org = organizations.value?.find((o: any) => o.id === orgId);
    try {
      // @ts-expect-error - organization plugin methods exist at runtime
      const { data, error } = await authClient.organization.inviteMember({
        organizationId: orgId,
        email: email.value,
        role: orgRole.value,
      });

      if (error) {
        results.push({ org: org?.name ?? orgId, success: false, error: error.message });
      }
      else if (data?.id) {
        // Wait a bit for the email hook to complete
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Check if email was sent
        const inviteStatus = await $fetch(`/api/invitations/${data.id}`);
        if (inviteStatus && inviteStatus.emailError) {
          results.push({
            org: org?.name ?? orgId,
            success: false,
            error: `Invitation created but email failed: ${inviteStatus.emailError}`,
          });
        }
        else if (inviteStatus && inviteStatus.emailSentAt) {
          results.push({ org: org?.name ?? orgId, success: true });
        }
        else {
          results.push({
            org: org?.name ?? orgId,
            success: false,
            error: "Email sending in progress...",
          });
        }
      }
      else {
        results.push({ org: org?.name ?? orgId, success: true });
      }
    }
    catch (error: any) {
      results.push({ org: org?.name ?? orgId, success: false, error: error.message });
    }
  }

  isSubmitting.value = false;

  const successCount = results.filter(r => r.success).length;
  const failureCount = results.length - successCount;

  if (failureCount === 0) {
    status.value = { type: "success", message: `Invitation sent to ${email.value} for ${successCount} tournament(s)!` };
    email.value = "";
    selectedOrganizations.value = [];
  }
  else if (successCount === 0) {
    const errors = results.map(r => !r.success ? `${r.org}: ${r.error}` : "").filter(Boolean).join("; ");
    status.value = { type: "error", message: `All invitations failed. ${errors}` };
  }
  else {
    const errors = results.filter(r => !r.success).map(r => `${r.org}: ${r.error}`).join("; ");
    status.value = { type: "error", message: `${successCount} succeeded, ${failureCount} failed. ${errors}` };
  }
}
</script>

<template>
  <div class="flex justify-center items-center min-h-screen bg-base-200 p-4">
    <!-- DaisyUI Card Component -->
    <div class="card w-full max-w-md bg-base-100 shadow-xl">
      <div class="card-body">
        <h2 class="card-title text-2xl font-bold mb-4">
          Invite Team Member
        </h2>
        <p class="text-sm opacity-70 mb-4">
          Send an invitation to join your tournament staff.
        </p>

        <!-- Status Alerts -->
        <div
          v-if="status"
          class="alert mb-4 shadow-sm flex items-start justify-between"
          :class="[
            status.type === 'success'
              ? 'bg-success/10 border border-success text-success-content'
              : 'bg-error/10 border border-error text-error-content',
          ]"
          role="alert"
        >
          <div class="flex items-start gap-3">
            <svg
              v-if="status.type === 'success'"
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5 shrink-0 mt-0.5"
              fill="currentColor"
              viewBox="0 0 24 24"
            ><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" /></svg>
            <svg
              v-else
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5 shrink-0 mt-0.5"
              fill="currentColor"
              viewBox="0 0 24 24"
            ><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" /></svg>
            <span class="flex-1">{{ status.message }}</span>
          </div>
          <button
            class="btn btn-ghost btn-sm"
            @click="dismissStatus"
          >
            ✕
          </button>
        </div>

        <div class="form-control w-full">
          <!-- DaisyUI Input with Label -->
          <label class="label"><span class="label-text">Recipient Email</span></label>
          <input
            v-model="email"
            type="email"
            placeholder="staff@example.com"
            class="input input-bordered w-full"
            :disabled="isSubmitting"
          >
        </div>

        <div class="form-control w-full mt-2">
          <!-- DaisyUI Select -->
          <label class="label"><span class="label-text">Assigned Role</span></label>
          <select
            v-model="role"
            class="select select-bordered w-full"
            :disabled="isSubmitting"
          >
            <option
              v-for="r in USER_ROLES"
              :key="r"
              :value="r"
            >
              {{ r.charAt(0).toUpperCase() + r.slice(1) }}
            </option>
          </select>
        </div>

        <div class="form-control w-full mt-2">
          <label class="label"><span class="label-text">Tournaments (select multiple)</span></label>
          <div v-if="pending" class="loading loading-spinner" />
          <div v-else-if="!organizations || organizations.length === 0" class="text-sm opacity-70">
            No tournaments available.
          </div>
          <div v-else class="flex flex-col gap-2 max-h-48 overflow-y-auto border border-base-300 rounded-lg p-3">
            <label
              v-for="org in organizations"
              :key="org.id"
              class="label cursor-pointer justify-start gap-2"
            >
              <input
                v-model="selectedOrganizations"
                type="checkbox"
                :value="org.id"
                class="checkbox checkbox-primary"
                :disabled="isSubmitting"
              >
              <span class="label-text">{{ org.name }}</span>
            </label>
          </div>
        </div>

        <div class="card-actions justify-end mt-6">
          <!-- DaisyUI Button with Loading State -->
          <button
            class="btn btn-primary w-full"
            :disabled="isSubmitting || !email || selectedOrganizations.length === 0"
            @click="handleInvite"
          >
            <span v-if="isSubmitting" class="loading loading-spinner" />
            <span v-else>Send Invitation</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Confirmation Modal -->
    <div
      v-if="showConfirmModal"
      class="modal modal-open"
    >
      <div class="modal-box w-full max-w-md bg-base-100 border border-base-300">
        <h3 class="font-bold text-lg mb-4">
          Resend Invitations?
        </h3>

        <div class="space-y-3 text-sm mb-6">
          <div class="bg-base-200/50 p-3 rounded border-2 border-info">
            <p class="font-semibold mb-2 flex items-center gap-2">
              <span class="text-lg">📧</span> {{ confirmData?.email }}
            </p>
            <p class="opacity-70 text-sm">
              already has pending invitations to:
            </p>
            <ul class="list-disc list-inside mt-2 space-y-1 opacity-80">
              <li
                v-for="org in confirmData?.existingOrgs"
                :key="org"
                class="text-sm"
              >
                {{ org }}
              </li>
            </ul>
          </div>

          <p v-if="confirmData && confirmData.newOrgsCount > 0" class="text-sm p-2 rounded bg-success/20 border border-success text-base-100 flex items-center gap-2">
            <span class="text-lg">✨</span> We will also send new invitations to <strong>{{ confirmData.newOrgsCount }}</strong> other tournament(s).
          </p>
        </div>

        <div class="modal-action gap-2">
          <button
            class="btn btn-ghost"
            @click="confirmNo"
          >
            Cancel
          </button>
          <button
            class="btn btn-success"
            @click="confirmYes"
          >
            Yes, Resend
          </button>
        </div>
      </div>
      <div
        class="modal-backdrop"
        @click="confirmNo"
      />
    </div>
  </div>
</template>
