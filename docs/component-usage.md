# Component Usage Guide

This project now includes reusable UI components for repeated tournament and discipline patterns.

## Proactive adoption standard

Whenever a new component, composable, or UX rule is created, apply it proactively:

- Replace existing duplicate patterns in currently relevant pages.
- Prefer shared composables for repeated state/behavior.
- Add a short usage note so future pages can adopt the same pattern immediately.
- Keep defaults backward-compatible.
- Run diagnostics on all touched files.

## `DisciplineInfoPage`

Use this for discipline detail pages that share the same layout (back button, title, intro text, CTA).

```vue
<DisciplineInfoPage
  title="Accuracy"
  lead="Accuracy is a precision throwing event..."
  cta-title="Want to compete in Accuracy events?"
  cta-description="Check our tournament listings to find upcoming events featuring Accuracy."
>
  <h2>Overview</h2>
  <p>...</p>
</DisciplineInfoPage>
```

Props:

- `title` (required)
- `lead` (required)
- `ctaTitle` (required)
- `ctaDescription` (required)
- `backTo` (default: `/tournaments`)
- `backLabel` (default: `Back to Tournaments`)
- `ctaTo` (default: `/tournaments`)
- `ctaButtonLabel` (default: `View Tournaments`)

## `EventTypesList`

Use this to render discipline/event badges from boolean flags.

```vue
<EventTypesList
  :has-golf="tournament.hasGolf"
  :has-accuracy="tournament.hasAccuracy"
  :has-distance="tournament.hasDistance"
  :has-scf="tournament.hasSCF"
  :has-discathon="tournament.hasDiscathon"
  :has-ddc="tournament.hasDDC"
  :has-freestyle="tournament.hasFreestyle"
  size="md"
  wrapper-class="flex flex-wrap gap-1.5 pt-3 border-t border-base-300"
/>
```

Props:

- `hasGolf`, `hasAccuracy`, `hasDistance`, `hasSCF`, `hasDiscathon`, `hasDDC`, `hasFreestyle` (all optional booleans)
- `size` (`sm | md | lg`, default: `md`)
- `wrapperClass` (default: empty string)

## `PageLoadingState`

Use this for consistent loading UI.

```vue
<PageLoadingState />

<PageLoadingState
  text="Loading tournaments..."
  wrapper-class="py-20"
  text-class="text-lg opacity-70"
/>
```

Props:

- `text` (optional)
- `wrapperClass` (default: `py-12`)
- `spinnerClass` (default: empty string)
- `textClass` (default: `text-sm opacity-70`)

## `MapLocationPopup`

Use this for Leaflet marker popup content (title, subtitle, optional details).

```vue
<LPopup>
  <MapLocationPopup
    :title="tournament.name"
    :title-to="`/tournaments/${tournament.slug}`"
    :subtitle="[tournament.city, tournament.country].filter(Boolean).join(', ')"
    :description="tournament.startDate ? new Date(tournament.startDate).toLocaleDateString() : 'TBD'"
    :centered="false"
  />
</LPopup>
```

Props:

- `title` (required)
- `titleTo` (optional route path)
- `subtitle` (optional)
- `description` (optional)
- `facilities` (optional)
- `centered` (default: `true`)

## `VenueListItem`

Use this for venue summary blocks in details/edit UIs.

```vue
<VenueListItem
  :venue="venue"
  :title="venue.name"
  coordinates-class="text-xs opacity-70"
/>
```

Props:

- `venue` (required: name, description/facilities optional, lat/long)
- `title` (optional override)
- `showCoordinates` (default: `true`)
- `coordinatesClass` (default: `text-sm opacity-70`)

## `TournamentCard`

Use this for tournament cards where title/status/description/date/location/event badges repeat.

```vue
<TournamentCard
  :title="tournament.name"
  :description="tournament.description"
  :date-text="formatDateRange(tournament.startDate, tournament.endDate)"
  :location-text="[tournament.city, tournament.country].filter(Boolean).join(', ')"
  :is-active="tournament.isActive"
  :status="tournament.status"
  :has-golf="tournament.hasGolf"
  :has-accuracy="tournament.hasAccuracy"
  :has-distance="tournament.hasDistance"
  :has-scf="tournament.hasSCF"
  :has-discathon="tournament.hasDiscathon"
  :has-ddc="tournament.hasDDC"
  :has-freestyle="tournament.hasFreestyle"
>
  <template #actions>
    <div class="pt-3 border-t border-base-300 mt-auto flex gap-2 justify-between">
      <!-- your action buttons -->
    </div>
  </template>
</TournamentCard>
```

Useful slots:

- `title-right` for custom badge area beside title
- `meta-top` for extra meta rows (for example role badges)
- `actions` for page-specific button/footer area

Common props:

- `title` (required)
- `description`, `dateText`, `locationText`
- `isActive`, `status`, `showStatusBadge`
- `descriptionClass`, `metaClass`, `iconSize`
- event booleans (`hasGolf`, `hasAccuracy`, `hasDistance`, `hasSCF`, `hasDiscathon`, `hasDDC`, `hasFreestyle`)

## `TournamentActionsRow`

Use this inside `TournamentCard` `actions` slot for consistent footer button spacing and border.

```vue
<template #actions>
  <TournamentActionsRow>
    <NuxtLink class="btn btn-ghost btn-sm">
      View Details
    </NuxtLink>
    <NuxtLink class="btn btn-primary btn-sm">
      Edit
    </NuxtLink>
  </TournamentActionsRow>
</template>
```

Dashboard-style variant:

```vue
<template #actions>
  <TournamentActionsRow justify="end" margin-top="sm">
    <NuxtLink class="btn btn-xs btn-outline">
      Edit Tournament
    </NuxtLink>
  </TournamentActionsRow>
</template>
```

Props:

- `justify`: `between | end | start` (default: `between`)
- `marginTop`: `auto | sm | md` (default: `auto`)

## `EmptyStateAlert`

Use this for reusable empty-list and no-data informational states.

```vue
<EmptyStateAlert message="No tournaments found for this filter." />
```

Props:

- `message` (required)
- `icon` (default: `tabler:info-circle`)
- `alertClass` (default: `alert alert-info`)

## `NavigationFeedback`

This is mounted globally in [app/app.vue](app/app.vue) and shows a loading message for route navigation.

```vue
<NavigationFeedback />
```

UX rule for all future pages:

- Keep all internal navigation on `NuxtLink` or `navigateTo` (avoid plain `<a href="/...">` for internal routes).
- Use local button-level loading text/spinner for action-initiated navigation where users can click and wait (for example "Opening...").
- Do not add new management navigation without visible loading feedback.

## `RadiusControl`

Generic distance selector component that stores values in kilometers and can optionally display miles.

```vue
<RadiusControl
  v-model="radiusKm"
  v-model:display-unit="distanceUnit"
  label="Nearby radius"
  :show-unit-toggle="true"
  :options="[50, 100, 200, 300, 500, 1000]"
/>
```

Props:

- `modelValue` (required, numeric radius in km)
- `options` (default: `50, 100, 200, 300, 500, 1000`)
- `label` (default: `Search radius`)
- `showUnitToggle` (default: `false`)
- `displayUnit` (`km | mi`, default: `km`)

Events:

- `update:modelValue` (km value)
- `update:displayUnit` (`km` or `mi`)

Persistence tip:

- For signed-in users, persist `displayUnit` to the user profile (`user.distanceUnit`) so the selected unit is preloaded on return visits.
- This workspace uses `PATCH /api/users/preferences` with `{ distanceUnit: "km" | "mi" }`.

Reusable pattern:

- Use `useDistanceUnitPreference()` from [app/composables/use-distance-unit-preference.ts](app/composables/use-distance-unit-preference.ts) and bind `distanceUnit` to `v-model:display-unit`.
- It syncs signed-in users to profile storage and keeps guest users on local browser storage.

## `FormHeader`

Use this for form page/modal headers where the title is on the left and helper text is right-aligned on desktop.

```vue
<FormHeader
  title="Edit Tournament"
  description="Update tournament details and venues."
  title-tag="h1"
  title-class="text-3xl font-bold"
/>
```

Modal example:

```vue
<FormHeader
  :title="isEditing ? 'Edit Venue' : 'Add Venue'"
  :description="isEditing ? 'Update venue details and location.' : 'Add venue details and location.'"
  title-tag="h3"
  title-class="text-lg font-bold"
  description-class="text-xs opacity-70"
  wrapper-class="mb-3"
/>
```

Props:

- `title` (required)
- `description` (optional)
- `titleTag` (`h1 | h2 | h3 | h4`, default: `h2`)
- `titleClass` (default: `font-bold`)
- `descriptionClass` (default: `text-sm opacity-70`)
- `descriptionMaxWidthClass` (default: `md:max-w-xl`)
- `wrapperClass` (default: empty string)

## `CountrySelect`

Use this where users should pick a country from a reusable list instead of free typing.

```vue
<FormField label="Country">
  <CountrySelect v-model="form.country" />
</FormField>
```

Props:

- `modelValue` (required)
- `placeholder` (default: `Select country`)
- `disabled` (default: `false`)

Notes:

- Uses an alphabetically sorted country list from `Intl.DisplayNames`.
- Stores the selected country name in the bound model.
- Preserves custom/legacy country values by showing them as a selectable option.

## `VerticalTabsLayout` + UI tab schema

Use this for dashboard-style pages where sections are split into accordion tabs and the tab set is controlled by a non-persisted UI schema.

Example schema:

```ts
export const EDIT_PAGE_TAB_SCHEME = {
  tabs: [
    { id: "general", label: "General", fields: ["name", "slug"] },
    { id: "contacts", label: "Contacts", fields: ["contactName", "contactEmail"] },
  ],
} as const;
```

Example usage:

```vue
<VerticalTabsLayout
  v-model="activeTab"
  :tabs="tabs"
  :initial-open-tab-ids="['map', 'venues']"
  :show-bulk-actions="true"
  session-state-key="tournament-view:my-slug"
>
  <template #general>
    <!-- general fields -->
  </template>
  <template #contacts>
    <!-- contact fields -->
  </template>
</VerticalTabsLayout>
```

Current implementation:

- Tab component: [app/components/vertical-tabs-layout.vue](app/components/vertical-tabs-layout.vue)
- Tournament edit tab scheme: [app/schemas/ui/tournament-edit-tabs.ts](app/schemas/ui/tournament-edit-tabs.ts)
- Tournament view tab scheme: [app/schemas/ui/tournament-view-tabs.ts](app/schemas/ui/tournament-view-tabs.ts)
- Shared default allocation utility: [app/schemas/ui/tab-scheme.ts](app/schemas/ui/tab-scheme.ts)
- Additional page schema example: [app/schemas/ui/admin-invites-tabs.ts](app/schemas/ui/admin-invites-tabs.ts)

Guideline:

- Keep tab definitions and field-to-tab mapping in the schema file.
- Keep rendering logic in page/components, using schema IDs as slot names.
- Use `buildTabScheme(...)` for default field allocation (General/Contacts/Disciplines/Scope by field naming), then override specific fields as needed.
- Use `useSchemaTabs(...)` from [app/composables/use-schema-tabs.ts](app/composables/use-schema-tabs.ts) to manage active tab state and jump to a tab by field key (for validation UX).

Interaction model:

- Each tab renders as a header row with an arrow on the right.
- Clicking a tab header opens that section directly under the header.
- Clicking an open tab header closes it.
- Multiple tabs can be open at the same time (or all closed).
- Optional bulk controls can open all or close all sections.
- The tab's fields/content are shown before the next tab header, in reading order.

Props:

- `initialOpenTabIds` (default: `[]`) sets which sections are expanded on first render.
- `showBulkActions` (default: `false`) enables `Open all` / `Close all` controls.
- `sessionStateKey` (optional) persists open/closed tab state in `sessionStorage` for the current browser session.

Responsiveness:

- `VerticalTabsLayout` is responsive by default.
- All breakpoints: stacked accordion sections.

## `server/utils/geo.ts`

Shared server-side geo helpers for reusable distance logic.

Exports:

- `distanceKm(lat1, lon1, lat2, lon2)`
- `kmToMiles(km)`
- `milesToKm(mi)`
