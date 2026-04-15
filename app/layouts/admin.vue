<script setup lang="ts">
import type { WorkspaceNavItem } from "~/components/workspace-shell.vue";

const route = useRoute();

const items: WorkspaceNavItem[] = [
  { id: "users", label: "Users", to: "/admin/users" },
  { id: "ban-requests", label: "Ban Requests", to: "/admin/ban-requests" },
  { id: "invitations", label: "Invitations", to: "/admin/invitations" },
  { id: "invite", label: "Send Invite", to: "/admin/invites" },
];

const activeId = computed(() => {
  if (route.path === "/admin/users")
    return "users";
  if (route.path === "/admin/ban-requests")
    return "ban-requests";
  if (route.path === "/admin/invitations")
    return "invitations";
  if (route.path === "/admin/invites")
    return "invite";
  return "";
});
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <NavBar />
    <main class="flex-1">
      <WorkspaceShell
        :items="items"
        :active-id="activeId"
        heading="User Management"
        back-to="/dashboard"
        back-label="My dashboard"
      >
        <slot />
      </WorkspaceShell>
    </main>
  </div>
</template>
