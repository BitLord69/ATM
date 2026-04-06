<script setup lang="ts">
import type { WorkspaceNavItem } from "~/components/workspace-shell.vue";
import type { DisciplineKey } from "~/composables/use-discipline-catalog";

import { disciplineByKey } from "~/composables/use-discipline-catalog";

const route = useRoute();

const slug = computed(() => route.params.slug as string);
const { data: tournamentData } = await useFetch(() => `/api/tournaments/${slug.value}/edit`);

const disciplineConfig = [
  { key: "hasGolf", slug: "golf" },
  { key: "hasAccuracy", slug: "accuracy" },
  { key: "hasDistance", slug: "distance" },
  { key: "hasSCF", slug: "scf" },
  { key: "hasDiscathon", slug: "discathon" },
  { key: "hasDDC", slug: "ddc" },
  { key: "hasFreestyle", slug: "freestyle" },
] as const satisfies ReadonlyArray<{ key: DisciplineKey; slug: string }>;

const enabledDisciplineLinks = computed(() => {
  if (!tournamentData.value || Array.isArray(tournamentData.value)) {
    return [] as Array<{ id: string; label: string; icon: string; to: string; indented: true }>;
  }

  return disciplineConfig
    .filter(item => !!(tournamentData.value as any)[item.key])
    .map(item => ({
      id: `discipline:${item.slug}`,
      label: disciplineByKey[item.key].label,
      icon: disciplineByKey[item.key].icon,
      to: `/dashboard/tournaments/${slug.value}/disciplines/${item.slug}`,
      indented: true as const,
    }));
});

const venueLinks = computed(() => {
  if (!tournamentData.value || Array.isArray(tournamentData.value)) {
    return [] as Array<{ id: string; label: string; to: string; indented: true }>;
  }

  const venues = ((tournamentData.value as any).venues || []) as Array<{ id: number; name?: string | null }>;
  return [...venues]
    .filter(venue => Number.isFinite(Number(venue.id)))
    .sort((left, right) => String(left.name || "").localeCompare(String(right.name || "")))
    .map(venue => ({
      id: `venue:${venue.id}`,
      label: venue.name?.trim() || `Venue ${venue.id}`,
      to: `/dashboard/tournaments/${slug.value}/venue/${String(venue.id)}`,
      indented: false as const,
    }));
});

const items = computed<WorkspaceNavItem[]>(() => {
  const base: WorkspaceNavItem[] = [
    { id: "overview", label: "Overview", to: `/dashboard/tournaments/${slug.value}` },
    { id: "details", label: "Details", to: `/dashboard/tournaments/${slug.value}/edit` },
    {
      kind: "section",
      id: "venues-section",
      label: "Venues",
      defaultOpen: route.path.includes("/venues") || route.path.includes("/venue/"),
      items: [
        { id: "venues", label: "All Venues", to: `/dashboard/tournaments/${slug.value}/venues` },
        ...venueLinks.value,
      ],
    },
    { id: "schedule", label: "Schedule", to: `/dashboard/tournaments/${slug.value}/schedule` },
    { id: "starting-lists", label: "Starting Lists", to: `/dashboard/tournaments/${slug.value}/starting-lists` },
    { id: "players", label: "Players", to: `/dashboard/tournaments/${slug.value}/players` },
  ];

  if (enabledDisciplineLinks.value.length > 0) {
    base.push({
      kind: "section",
      id: "disciplines-section",
      label: "Disciplines",
      defaultOpen: route.path.includes("/disciplines/"),
      items: enabledDisciplineLinks.value,
    });
  }

  return base;
});

const activeSection = computed(() => {
  const path = route.path;
  if (path.endsWith("/edit"))
    return "details";
  if (path.endsWith("/venues"))
    return "venues";
  if (path.endsWith("/schedule"))
    return "schedule";
  if (path.endsWith("/starting-lists"))
    return "starting-lists";
  if (path.endsWith("/players"))
    return "players";
  if (path.includes("/venue/")) {
    const venueId = route.params.id;
    if (typeof venueId === "string") {
      return `venue:${venueId}`;
    }
  }
  if (path.includes("/disciplines/")) {
    const discipline = route.params.discipline;
    if (typeof discipline === "string") {
      return `discipline:${discipline}`;
    }
  }
  return "overview";
});
</script>

<template>
  <WorkspaceShell
    :items="items"
    :active-id="activeSection"
    :heading="tournamentData && !Array.isArray(tournamentData) ? tournamentData.name : undefined"
    back-to="/dashboard"
    back-label="← Back to Dashboard"
    badge-text="Tournament Workspace"
  >
    <div :key="route.fullPath">
      <slot />
    </div>
  </WorkspaceShell>
</template>
