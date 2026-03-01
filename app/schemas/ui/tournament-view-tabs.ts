import type { VerticalTabConfig } from "~/components/vertical-tabs-layout.vue";

import { buildTabScheme } from "~/schemas/ui/tab-scheme";

const TOURNAMENT_VIEW_TABS = [
  { id: "overview", label: "Overview" },
  { id: "contacts", label: "Contacts" },
  { id: "map", label: "Map" },
  { id: "venues", label: "Venues" },
] as const satisfies readonly VerticalTabConfig[];

export type TournamentViewTabId = (typeof TOURNAMENT_VIEW_TABS)[number]["id"];

const tournamentViewFields = [
  "description",
  "startDate",
  "endDate",
  "city",
  "country",
  "hasGolf",
  "hasAccuracy",
  "hasDistance",
  "hasSCF",
  "hasDiscathon",
  "hasDDC",
  "hasFreestyle",
  "contactName",
  "contactEmail",
  "contactPhone",
  "directorName",
  "directorEmail",
  "directorPhone",
  "lat",
  "long",
  "venues",
] as const;

export const TOURNAMENT_VIEW_TAB_SCHEME = buildTabScheme({
  tabs: [...TOURNAMENT_VIEW_TABS],
  fields: [...tournamentViewFields],
  fieldOverrides: {
    description: "overview",
    startDate: "overview",
    endDate: "overview",
    city: "overview",
    country: "overview",
    hasGolf: "overview",
    hasAccuracy: "overview",
    hasDistance: "overview",
    hasSCF: "overview",
    hasDiscathon: "overview",
    hasDDC: "overview",
    hasFreestyle: "overview",
    contactName: "contacts",
    contactEmail: "contacts",
    contactPhone: "contacts",
    directorName: "contacts",
    directorEmail: "contacts",
    directorPhone: "contacts",
    lat: "map",
    long: "map",
    venues: "venues",
  },
});

export const tournamentViewTabs: VerticalTabConfig[] = TOURNAMENT_VIEW_TAB_SCHEME.tabs;
