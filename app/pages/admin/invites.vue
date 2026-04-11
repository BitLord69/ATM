<script setup lang="ts">
import type { AdminInvitesTabId } from "~/schemas/ui/admin-invites-tabs";

import { adminInvitesFieldToTab, adminInvitesTabs } from "~/schemas/ui/admin-invites-tabs";
import { useAuthClient } from "~/stores/auth";

definePageMeta({
  layout: "admin",
  ssr: false,
});

const authClient = useAuthClient();
const route = useRoute();
const email = ref("");
type GlobalInviteRole = "user" | "admin";
type TournamentInviteRole = "owner" | "admin" | "td" | "scorer" | "viewer";

const isGlobalAdmin = ref(false);
const tournamentRole = ref<TournamentInviteRole>("viewer");
const selectedOrganizations = ref<string[]>([]);
const tournamentSearch = ref("");
const {
  activeTab,
  openTabForField,
} = useSchemaTabs<AdminInvitesTabId>({
  tabs: adminInvitesTabs,
  defaultTab: "general",
  fieldToTab: adminInvitesFieldToTab,
});
const orgRole = computed<"admin" | "member" | "owner">(() => {
  // Better Auth organization invitation accepts only organization roles.
  if (isGlobalAdmin.value) {
    return "admin";
  }
  return "member";
});
const globalRoleTarget = computed<GlobalInviteRole>(() => (isGlobalAdmin.value ? "admin" : "user"));
const selectedTournamentCount = computed(() => selectedOrganizations.value.length);
const requiresTournamentSelection = computed(() => !isGlobalAdmin.value);
const isSubmitting = ref(false);
const status = ref<{ type: "success" | "error"; message: string } | null>(null);

const EMAIL_SPLIT_REGEX = /[;\n]+/;
type ExistingInvitationCheck = {
  orgId: string;
  orgName: string;
  invitation: { id: string } | null;
};

type RecipientInvitePlan = {
  recipientEmail: string;
  existingChecks: ExistingInvitationCheck[];
  newOrganizations: string[];
};

type ConfirmDialogData = {
  mode: "single";
  email: string;
  existingOrgs: string[];
  newOrgsCount: number;
  existingChecks: ExistingInvitationCheck[];
  newOrganizations: string[];
} | {
  mode: "batch";
  recipientCount: number;
  existingCount: number;
  newCount: number;
  preview: Array<{ email: string; orgNames: string[] }>;
};

type InviteStatusResponse = {
  emailError?: string | null;
  emailSentAt?: number | null;
};
const tournamentRoleGuide: Array<{
  role: TournamentInviteRole;
  label: string;
  scope: string;
  capabilities: string;
  responsibilities: string;
}> = [
  {
    role: "owner",
    label: "Owner",
    scope: "Tournament governance",
    capabilities: "Full control, including owner-only lifecycle actions.",
    responsibilities: "Final accountability for tournament setup and policy.",
  },
  {
    role: "admin",
    label: "Admin",
    scope: "Tournament administration",
    capabilities: "Broad management permissions without owner-only authority.",
    responsibilities: "Supports setup, coordination, and administrative upkeep.",
  },
  {
    role: "td",
    label: "TD",
    scope: "Tournament operations",
    capabilities: "Runs day-to-day competition flow and staffing tasks.",
    responsibilities: "Execution quality, schedule flow, and fair operations.",
  },
  {
    role: "scorer",
    label: "Scorer",
    scope: "Scoring operations",
    capabilities: "Manages scoring and result entry workflows.",
    responsibilities: "Accurate and timely score capture and validation.",
  },
  {
    role: "viewer",
    label: "Viewer",
    scope: "Read-only access",
    capabilities: "Can view tournament data without administrative changes.",
    responsibilities: "Follow tournament progress and reporting visibility.",
  },
];

function parseRecipientEmails(raw: string) {
  return raw
    .split(EMAIL_SPLIT_REGEX)
    .map(item => item.trim().toLowerCase())
    .filter(Boolean);
}

function isValidEmailAddress(value: string) {
  if (!value || value.includes(" ")) {
    return false;
  }
  const atIndex = value.indexOf("@");
  if (atIndex <= 0 || atIndex !== value.lastIndexOf("@")) {
    return false;
  }
  const domain = value.slice(atIndex + 1);
  if (!domain || domain.startsWith(".") || domain.endsWith(".")) {
    return false;
  }
  return domain.includes(".");
}

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
const confirmData = ref<ConfirmDialogData | null>(null);

let confirmResolve: ((value: boolean) => void) | null = null;

function showConfirmDialog(data: ConfirmDialogData) {
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

// Fetch invite-eligible tournaments (active/upcoming only)
const { data: organizations, pending } = await useFetch("/api/admin/invite-tournaments");

const filteredOrganizations = computed(() => {
  const list = organizations.value ?? [];
  const search = tournamentSearch.value.trim().toLowerCase();

  if (!search) {
    return list;
  }

  return list.filter((org: any) => {
    const name = String(org.name ?? "").toLowerCase();
    const slug = String(org.slug ?? "").toLowerCase();
    return name.includes(search) || slug.includes(search);
  });
});

watch(
  () => [organizations.value, route.query.organizationId],
  () => {
    const orgId = route.query.organizationId;
    if (typeof orgId !== "string" || !organizations.value?.some((org: any) => org.id === orgId)) {
      return;
    }

    if (!selectedOrganizations.value.includes(orgId)) {
      selectedOrganizations.value = [orgId];
    }
  },
  { immediate: true },
);

async function handleInvite() {
  if (!email.value.trim()) {
    openTabForField("email");
    status.value = { type: "error", message: "Please enter a recipient email." };
    return;
  }

  const recipients = [...new Set(parseRecipientEmails(email.value))];
  if (recipients.length === 0) {
    openTabForField("email");
    status.value = { type: "error", message: "Please enter at least one valid recipient email." };
    return;
  }

  const invalidEmails = recipients.filter(item => !isValidEmailAddress(item));
  if (invalidEmails.length > 0) {
    openTabForField("email");
    status.value = {
      type: "error",
      message: `Invalid email(s): ${invalidEmails.join(", ")}`,
    };
    return;
  }

  if (requiresTournamentSelection.value && selectedOrganizations.value.length === 0) {
    openTabForField("selectedOrganizations");
    status.value = { type: "error", message: "Please select at least one tournament." };
    return;
  }

  const inviteOrganizationIds = selectedOrganizations.value.length > 0
    ? [...selectedOrganizations.value]
    : (isGlobalAdmin.value && organizations.value?.[0]?.id ? [organizations.value[0].id] : []);

  if (inviteOrganizationIds.length === 0) {
    openTabForField("selectedOrganizations");
    status.value = { type: "error", message: "No invite-eligible tournaments are available for issuing this invitation." };
    return;
  }

  isSubmitting.value = true;
  status.value = null;

  const results: Array<{ email: string; org: string; success: boolean; error?: string }> = [];
  const invitePlans: RecipientInvitePlan[] = [];

  for (const recipientEmail of recipients) {
    // First, check for existing invitations
    const existingChecks: ExistingInvitationCheck[] = [];
    const newOrganizations: string[] = [];

    for (const orgId of inviteOrganizationIds) {
      const check = await $fetch("/api/invitations/check", {
        method: "POST",
        body: { email: recipientEmail, organizationId: orgId },
      });
      if (check.exists) {
        const org = organizations.value?.find((o: any) => o.id === orgId);
        existingChecks.push({ orgId, orgName: org?.name || orgId, invitation: check.invitation });
      }
      else {
        newOrganizations.push(orgId);
      }
    }

    invitePlans.push({
      recipientEmail,
      existingChecks,
      newOrganizations,
    });
  }

  // For a single-recipient flow keep the explicit resend confirmation.
  if (recipients.length === 1) {
    const singlePlan = invitePlans[0];
    if (singlePlan?.existingChecks.length) {
      const orgNames = singlePlan.existingChecks.map(c => c.orgName);
      const shouldResend = await showConfirmDialog({
        mode: "single",
        email: singlePlan.recipientEmail,
        existingOrgs: orgNames,
        newOrgsCount: singlePlan.newOrganizations.length,
        existingChecks: singlePlan.existingChecks,
        newOrganizations: singlePlan.newOrganizations,
      });

      if (!shouldResend) {
        isSubmitting.value = false;
        return;
      }
    }
  }
  else {
    const plansWithExisting = invitePlans.filter(plan => plan.existingChecks.length > 0);
    if (plansWithExisting.length > 0) {
      const shouldContinue = await showConfirmDialog({
        mode: "batch",
        recipientCount: recipients.length,
        existingCount: plansWithExisting.reduce((sum, plan) => sum + plan.existingChecks.length, 0),
        newCount: invitePlans.reduce((sum, plan) => sum + plan.newOrganizations.length, 0),
        preview: plansWithExisting.slice(0, 5).map(plan => ({
          email: plan.recipientEmail,
          orgNames: plan.existingChecks.map(c => c.orgName),
        })),
      });

      if (!shouldContinue) {
        isSubmitting.value = false;
        return;
      }
    }
  }

  for (const { recipientEmail, existingChecks, newOrganizations } of invitePlans) {
    // Resend existing invitations
    for (const { orgName, invitation } of existingChecks) {
      if (!invitation?.id) {
        results.push({ email: recipientEmail, org: orgName, success: false, error: "Existing invitation ID not found." });
        continue;
      }
      try {
        await $fetch(`/api/invitations/${invitation.id}/target-role`, {
          method: "PATCH",
          body: {
            tournamentRole: tournamentRole.value,
            globalRoleTarget: globalRoleTarget.value,
          },
        });

        await $fetch(`/api/invitations/${invitation.id}/resend`, { method: "POST" });
        results.push({ email: recipientEmail, org: orgName, success: true });
      }
      catch (error: any) {
        results.push({ email: recipientEmail, org: orgName, success: false, error: error.message });
      }
    }

    // Send invitations for NEW organizations
    for (const orgId of newOrganizations) {
      const org = organizations.value?.find((o: any) => o.id === orgId);
      try {
        // @ts-expect-error - organization plugin methods exist at runtime
        const { data, error } = await authClient.organization.inviteMember({
          organizationId: orgId,
          email: recipientEmail,
          role: orgRole.value,
        });

        if (error) {
          results.push({ email: recipientEmail, org: org?.name ?? orgId, success: false, error: error.message });
        }
        else if (data?.id) {
          await $fetch(`/api/invitations/${data.id}/target-role`, {
            method: "PATCH",
            body: {
              tournamentRole: tournamentRole.value,
              globalRoleTarget: globalRoleTarget.value,
            },
          });

          // Wait a bit for the email hook to complete
          await new Promise(resolve => setTimeout(resolve, 1000));

          // Check if email was sent
          const inviteStatus = await $fetch<InviteStatusResponse>(`/api/invitations/${data.id}`);
          if (inviteStatus && inviteStatus.emailError) {
            results.push({
              email: recipientEmail,
              org: org?.name ?? orgId,
              success: false,
              error: `Invitation created but email failed: ${inviteStatus.emailError}`,
            });
          }
          else if (inviteStatus && inviteStatus.emailSentAt) {
            results.push({ email: recipientEmail, org: org?.name ?? orgId, success: true });
          }
          else {
            results.push({
              email: recipientEmail,
              org: org?.name ?? orgId,
              success: false,
              error: "Email sending in progress...",
            });
          }
        }
        else {
          results.push({ email: recipientEmail, org: org?.name ?? orgId, success: true });
        }
      }
      catch (error: any) {
        results.push({ email: recipientEmail, org: org?.name ?? orgId, success: false, error: error.message });
      }
    }
  }

  isSubmitting.value = false;

  const successCount = results.filter(r => r.success).length;
  const failureCount = results.length - successCount;
  const recipientCount = recipients.length;

  if (failureCount === 0) {
    status.value = {
      type: "success",
      message: isGlobalAdmin.value && selectedOrganizations.value.length === 0
        ? `Invitation sent to ${recipientCount} recipient(s) with global admin access.`
        : `Invitation sent to ${recipientCount} recipient(s) across ${successCount} invitation(s).`,
    };
    email.value = "";
    selectedOrganizations.value = [];
  }
  else if (successCount === 0) {
    const errors = results.map(r => !r.success ? `${r.email} @ ${r.org}: ${r.error}` : "").filter(Boolean).join("; ");
    status.value = { type: "error", message: `All invitations failed. ${errors}` };
  }
  else {
    const errors = results.filter(r => !r.success).map(r => `${r.email} @ ${r.org}: ${r.error}`).join("; ");
    status.value = { type: "error", message: `${successCount} succeeded, ${failureCount} failed. ${errors}` };
  }
}
</script>

<template>
  <div class="space-y-4">
    <h2 class="text-lg font-semibold">
      Send Invite
    </h2>

    <!-- Status Alerts -->
    <div
      v-if="status"
      class="alert shadow-sm flex items-start justify-between"
      :class="[
        status.type === 'success'
          ? 'alert-success'
          : 'alert-error',
      ]"
      role="alert"
    >
      <div class="flex items-start gap-3">
        <span class="flex-1">{{ status.message }}</span>
      </div>
      <button
        class="btn btn-ghost btn-sm"
        @click="dismissStatus"
      >
        ✕
      </button>
    </div>

    <VerticalTabsLayout
      v-model="activeTab"
      :tabs="adminInvitesTabs"
      session-state-key="admin-invites"
    >
      <template #general>
        <div class="grid grid-cols-1 gap-3">
          <FormField
            label="Recipient Email"
            wrapper-class="w-full"
          >
            <div class="relative w-full">
              <input
                v-model="email"
                type="text"
                placeholder="staff@example.com; second@example.com"
                class="input input-bordered w-full pr-10"
                :disabled="isSubmitting"
              >
              <button
                v-if="email"
                type="button"
                class="btn btn-ghost btn-xs absolute right-2 top-1/2 -translate-y-1/2"
                :disabled="isSubmitting"
                @click="email = ''"
              >
                ✕
              </button>
            </div>
            <p class="text-xs opacity-70 mt-2">
              Invite multiple users by separating emails with a semicolon (;).
            </p>
          </FormField>

          <FormField
            label="Global Role"
            wrapper-class="w-full"
          >
            <ToggleField
              v-model="isGlobalAdmin"
              label="Set as global admin"
              :disabled="isSubmitting"
              :stacked="false"
            />
            <p class="text-xs opacity-70 mt-2">
              Global role is site-wide. Off = User, On = Admin. Tournament permissions are set separately below.
            </p>
          </FormField>
        </div>
      </template>

      <template #tournaments>
        <div class="form-control w-full">
          <div class="label min-h-5 flex items-center justify-between">
            <span class="label-text">Tournament(s), multiple selection possible</span>
            <span class="label-text-alt">{{ selectedTournamentCount }} selected</span>
          </div>
          <div class="mb-3">
            <input
              v-model="tournamentSearch"
              type="search"
              class="input input-bordered w-full"
              placeholder="Search tournaments by name..."
              :disabled="isSubmitting"
            >
          </div>
          <div v-if="pending" class="loading loading-spinner" />
          <div v-else-if="!organizations || organizations.length === 0" class="text-sm opacity-70">
            No active or upcoming tournaments available.
          </div>
          <div v-else-if="filteredOrganizations.length === 0" class="text-sm opacity-70">
            No tournaments match your search.
          </div>
          <div v-else class="flex flex-col gap-3 max-h-64 overflow-y-auto border border-base-300 rounded-lg p-3">
            <ToggleField
              v-for="org in filteredOrganizations"
              :key="org.id"
              v-model="selectedOrganizations"
              :value="org.id"
              :label="org.name"
              :disabled="isSubmitting"
              :stacked="false"
            />
          </div>

          <div class="mt-4">
            <FormField
              label="Assign Role (Tournament)"
              wrapper-class="w-full"
            >
              <select
                v-model="tournamentRole"
                class="select select-bordered w-full bg-base-100 text-base-content border-base-300 hover:border-base-content/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                :disabled="isSubmitting"
              >
                <option value="viewer">
                  Viewer
                </option>
                <option value="scorer">
                  Scorer
                </option>
                <option value="td">
                  TD
                </option>
                <option value="admin">
                  Admin
                </option>
                <option value="owner">
                  Owner
                </option>
              </select>
              <p class="text-xs opacity-70 mt-2">
                Tournament role applies within selected tournament(s).
              </p>
            </FormField>

            <div class="mt-4 border border-base-300 rounded-lg overflow-hidden">
              <div class="px-3 py-2 bg-base-200/60 text-sm font-semibold">
                Role Quick Guide
              </div>
              <div class="overflow-x-auto">
                <table class="table table-sm">
                  <thead>
                    <tr>
                      <th>Role</th>
                      <th>Scope</th>
                      <th>Capabilities</th>
                      <th>Main Responsibility</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="row in tournamentRoleGuide"
                      :key="row.role"
                      :class="row.role === tournamentRole ? 'bg-primary/10' : ''"
                    >
                      <td class="font-medium">
                        <div class="flex items-center gap-2">
                          <span>{{ row.label }}</span>
                          <span v-if="row.role === tournamentRole" class="badge badge-primary badge-xs">Selected</span>
                        </div>
                      </td>
                      <td>{{ row.scope }}</td>
                      <td>{{ row.capabilities }}</td>
                      <td>{{ row.responsibilities }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </template>
    </VerticalTabsLayout>

    <div class="flex justify-end mt-4">
      <button
        class="btn btn-primary"
        :disabled="isSubmitting || !email || (requiresTournamentSelection && selectedOrganizations.length === 0)"
        @click="handleInvite"
      >
        <span v-if="isSubmitting" class="loading loading-spinner" />
        <span v-else>Send Invitation</span>
      </button>
    </div>

    <!-- Confirmation Modal -->
    <div
      v-if="showConfirmModal"
      class="modal modal-open"
    >
      <div class="modal-box w-full max-w-md bg-base-100 border border-base-300">
        <h3 class="font-bold text-lg mb-4">
          {{ confirmData?.mode === 'batch' ? 'Confirm Batch Sending' : 'Resend Invitations?' }}
        </h3>

        <div class="space-y-3 text-sm mb-6">
          <div v-if="confirmData?.mode === 'single'" class="bg-base-200/50 p-3 rounded border-2 border-info">
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

          <div v-else-if="confirmData?.mode === 'batch'" class="bg-base-200/50 p-3 rounded border-2 border-info space-y-2">
            <p class="font-semibold">
              {{ confirmData.recipientCount }} recipients in this batch
            </p>
            <p class="opacity-80">
              {{ confirmData.existingCount }} existing invitation(s) will be resent and
              {{ confirmData.newCount }} new invitation(s) will be sent.
            </p>
            <div v-if="confirmData.preview.length > 0" class="text-xs opacity-80 space-y-1">
              <p class="font-medium">
                Existing invite preview:
              </p>
              <p
                v-for="item in confirmData.preview"
                :key="item.email"
              >
                {{ item.email }}: {{ item.orgNames.join(", ") }}
              </p>
            </div>
          </div>

          <p v-if="confirmData?.mode === 'single' && confirmData.newOrgsCount > 0" class="text-sm p-2 rounded bg-success/20 border border-success text-base-100 flex items-center gap-2">
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
            {{ confirmData?.mode === 'batch' ? 'Yes, Continue' : 'Yes, Resend' }}
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
