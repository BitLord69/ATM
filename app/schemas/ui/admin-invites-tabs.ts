import type { VerticalTabConfig } from "~/components/vertical-tabs-layout.vue";

import { buildTabScheme } from "~/schemas/ui/tab-scheme";

const ADMIN_INVITES_TABS = [
  { id: "general", label: "General" },
  { id: "tournaments", label: "Tournaments" },
] as const satisfies readonly VerticalTabConfig[];

export type AdminInvitesTabId = (typeof ADMIN_INVITES_TABS)[number]["id"];

const adminInvitesFields = ["email", "role", "selectedOrganizations"] as const;

export const ADMIN_INVITES_TAB_SCHEME = buildTabScheme({
  tabs: [...ADMIN_INVITES_TABS],
  fields: [...adminInvitesFields],
  fieldOverrides: {
    email: "general",
    role: "general",
    selectedOrganizations: "tournaments",
  },
});

export const adminInvitesTabs: VerticalTabConfig[] = ADMIN_INVITES_TAB_SCHEME.tabs;
export const adminInvitesFieldToTab = ADMIN_INVITES_TAB_SCHEME.fieldToTab as Record<string, AdminInvitesTabId>;
