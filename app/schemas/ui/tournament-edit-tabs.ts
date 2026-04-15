import type { VerticalTabConfig } from "~/components/vertical-tabs-layout.vue";

import { buildTabScheme } from "~/schemas/ui/tab-scheme";

const TOURNAMENT_EDIT_TABS = [
  { id: "general", label: "General" },
  { id: "contacts", label: "Contacts" },
  { id: "disciplines", label: "Disciplines" },
  { id: "map", label: "Map" },
  { id: "venue-actions", label: "Venue Actions" },
  { id: "venue-list", label: "Venue List" },
] as const satisfies readonly VerticalTabConfig[];

export type TournamentEditTabId = (typeof TOURNAMENT_EDIT_TABS)[number]["id"];

const tournamentEditFields = [
  "name",
  "slug",
  "description",
  "country",
  "city",
  "startDate",
  "endDate",
  "contactName",
  "contactEmail",
  "contactPhone",
  "directorName",
  "directorEmail",
  "directorPhone",
  "banRequestEmailEnabled",
  "hasGolf",
  "hasAccuracy",
  "hasDistance",
  "hasSCF",
  "hasDiscathon",
  "hasDDC",
  "hasFreestyle",
  "lat",
  "long",
  "venues",
] as const;

export const TOURNAMENT_EDIT_TAB_SCHEME = buildTabScheme({
  tabs: [...TOURNAMENT_EDIT_TABS],
  fields: [...tournamentEditFields],
  fieldOverrides: {
    name: "general",
    slug: "general",
    description: "general",
    country: "general",
    city: "general",
    startDate: "general",
    endDate: "general",
    contactName: "contacts",
    contactEmail: "contacts",
    contactPhone: "contacts",
    directorName: "contacts",
    directorEmail: "contacts",
    directorPhone: "contacts",
    banRequestEmailEnabled: "contacts",
    hasGolf: "disciplines",
    hasAccuracy: "disciplines",
    hasDistance: "disciplines",
    hasSCF: "disciplines",
    hasDiscathon: "disciplines",
    hasDDC: "disciplines",
    hasFreestyle: "disciplines",
    lat: "map",
    long: "map",
    venues: "venue-actions",
  },
});

export const tournamentEditTabs: VerticalTabConfig[] = TOURNAMENT_EDIT_TAB_SCHEME.tabs;
export const tournamentEditFieldToTab = TOURNAMENT_EDIT_TAB_SCHEME.fieldToTab as Record<string, TournamentEditTabId>;
