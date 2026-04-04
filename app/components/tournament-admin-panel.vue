<script setup lang="ts">
const props = defineProps<{
  slug: string;
  title?: string;
  section: "overview" | "details" | "venues" | "schedule" | "starting-lists" | "players";
}>();

const links = computed(() => [
  { id: "overview", label: "Overview", to: `/dashboard/tournaments/${props.slug}` },
  { id: "details", label: "Details", to: `/dashboard/tournaments/${props.slug}/edit` },
  { id: "venues", label: "Venues", to: `/dashboard/tournaments/${props.slug}/venues` },
  { id: "schedule", label: "Schedule", to: `/dashboard/tournaments/${props.slug}/schedule` },
  { id: "starting-lists", label: "Starting Lists", to: `/dashboard/tournaments/${props.slug}/starting-lists` },
  { id: "players", label: "Players", to: `/dashboard/tournaments/${props.slug}/players` },
]);

const items = computed(() => links.value.map(link => ({
  kind: "link" as const,
  ...link,
})));
</script>

<template>
  <WorkspaceShell
    :items="items"
    :active-id="section"
    :heading="title"
    back-to="/dashboard"
    back-label="← Back to Dashboard"
    badge-text="Tournament Workspace"
  >
    <slot />
  </WorkspaceShell>
</template>
