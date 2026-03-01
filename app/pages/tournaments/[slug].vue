<script setup lang="ts">
/**
 * Public tournament detail page
 * Accessible to everyone including guests
 */

import type { TournamentViewTabId } from "~/schemas/ui/tournament-view-tabs";

import { tournamentViewTabs } from "~/schemas/ui/tournament-view-tabs";

type TournamentDetail = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  country: string | null;
  city: string | null;
  lat: number;
  long: number;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  directorName: string | null;
  directorEmail: string | null;
  directorPhone: string | null;
  startDate: number | null;
  endDate: number | null;
  closedAt: number | null;
  hasGolf: boolean;
  hasAccuracy: boolean;
  hasDistance: boolean;
  hasSCF: boolean;
  hasDiscathon: boolean;
  hasDDC: boolean;
  hasFreestyle: boolean;
  organizationId: string;
  status: "active" | "future" | "past";
  isActive: boolean;
  venues: Array<{
    id: number;
    name: string;
    description: string | null;
    facilities: string | null;
    lat: number;
    long: number;
  }>;
};

const route = useRoute();
const slug = route.params.slug as string;

const { data: tournament, pending, error } = await useFetch<TournamentDetail>(`/api/tournaments/${slug}`);
const {
  canEditTournament,
  isSysadmin,
  canInviteMembers,
} = useTournamentPermissions(slug);
const { activeTab: activeViewTab } = useSchemaTabs<TournamentViewTabId>({
  tabs: tournamentViewTabs,
  defaultTab: "overview",
});
const openingInvitePage = ref(false);

async function openInvitePage(organizationId: string) {
  if (openingInvitePage.value) {
    return;
  }

  openingInvitePage.value = true;
  try {
    await navigateTo(`/admin/invites?organizationId=${encodeURIComponent(organizationId)}`);
  }
  finally {
    openingInvitePage.value = false;
  }
}

const isTournamentFinished = computed(() => tournament.value?.status === "past");
const isTournamentClosed = computed(() => tournament.value?.closedAt != null);
const showInviteButton = computed(() => canInviteMembers.value && !isTournamentFinished.value && !isTournamentClosed.value);
const showEditButton = computed(() => {
  if (isSysadmin.value) {
    return true;
  }
  return canEditTournament.value && !isTournamentFinished.value && !isTournamentClosed.value;
});

if (error.value) {
  throw createError({
    statusCode: error.value.statusCode || 404,
    message: error.value.message || "Tournament not found",
  });
}

function formatDate(timestamp: number | null | undefined) {
  if (!timestamp)
    return "TBD";
  return new Date(timestamp).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateRange(start: number | null | undefined, end: number | null | undefined) {
  if (!start || !end)
    return "Dates TBD";
  const startDate = new Date(start);
  const endDate = new Date(end);

  if (startDate.toDateString() === endDate.toDateString()) {
    return formatDate(start);
  }

  return `${formatDate(start)} - ${formatDate(end)}`;
}

const tournamentDirectorEmail = computed(() => tournament.value?.directorEmail || tournament.value?.contactEmail || null);
const hasMapCoordinates = computed(() => {
  if (!tournament.value) {
    return false;
  }

  return tournament.value.lat != null
    && tournament.value.long != null
    && tournament.value.lat !== 0
    && tournament.value.long !== 0;
});

const hasContactData = computed(() => {
  if (!tournament.value) {
    return false;
  }

  return !!(tournament.value.contactName || tournament.value.contactEmail || tournament.value.contactPhone);
});

const hasDirectorData = computed(() => {
  if (!tournament.value) {
    return false;
  }

  return !!(tournament.value.directorName || tournament.value.directorEmail || tournament.value.directorPhone);
});
</script>

<template>
  <div class="container mx-auto p-4 max-w-4xl">
    <!-- Loading State -->
    <PageLoadingState v-if="pending" />

    <!-- Tournament Details -->
    <div v-else-if="tournament">
      <!-- Back Button and Management Buttons -->
      <div class="mb-4 flex flex-wrap items-center gap-2 justify-between">
        <NuxtLink
          to="/tournaments"
          class="btn btn-ghost btn-sm gap-2"
        >
          <Icon
            name="tabler:arrow-left"
            size="18"
          />
          Back to Tournaments
        </NuxtLink>
        <div class="flex items-center gap-2">
          <button
            v-if="showInviteButton && tournament"
            class="btn btn-secondary btn-sm gap-2"
            :disabled="openingInvitePage"
            @click="openInvitePage(tournament.organizationId)"
          >
            <Icon
              v-if="!openingInvitePage"
              name="tabler:user-plus"
              size="18"
            />
            <span
              v-else
              class="loading loading-spinner loading-sm"
            />
            {{ openingInvitePage ? "Opening..." : "Invite Member" }}
          </button>
          <NuxtLink
            v-if="showEditButton"
            :to="`/dashboard/tournaments/${slug}/edit`"
            class="btn btn-primary btn-sm gap-2"
          >
            <Icon
              name="tabler:edit"
              size="18"
            />
            Edit Tournament
          </NuxtLink>
        </div>
      </div>

      <!-- Header -->
      <div class="mb-6">
        <div class="flex items-start justify-between gap-4 mb-2">
          <h1 class="text-4xl font-bold">
            {{ tournament.name }}
          </h1>
          <span
            v-if="tournament.isActive"
            class="badge badge-success gap-2 py-3"
          >
            <span class="w-2 h-2 bg-white rounded-full animate-pulse" />
            Live Now
          </span>
          <span
            v-else-if="tournament.status === 'future'"
            class="badge badge-info py-3"
          >
            Upcoming
          </span>
          <span
            v-else
            class="badge badge-ghost py-3"
          >
            Past Event
          </span>
        </div>
      </div>

      <div class="mb-6">
        <VerticalTabsLayout
          v-model="activeViewTab"
          :tabs="tournamentViewTabs"
          :initial-open-tab-ids="['map', 'venues']"
          :session-state-key="`tournament-view:${slug}`"
        >
          <template #overview>
            <div class="space-y-4">
              <div
                v-if="tournament.description"
                class="prose max-w-none"
              >
                <p class="text-lg">
                  {{ tournament.description }}
                </p>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="card bg-base-200">
                  <div class="card-body">
                    <h3 class="card-title text-base flex items-center gap-2">
                      <Icon
                        name="tabler:calendar"
                        size="20"
                      />
                      Date & Time
                    </h3>
                    <p class="text-sm">
                      {{ formatDateRange(tournament.startDate, tournament.endDate) }}
                    </p>
                  </div>
                </div>

                <div class="card bg-base-200">
                  <div class="card-body">
                    <h3 class="card-title text-base flex items-center gap-2">
                      <Icon
                        name="tabler:map-pin"
                        size="20"
                      />
                      Location
                    </h3>
                    <p class="text-sm">
                      {{ [tournament.city, tournament.country].filter(Boolean).join(", ") || "Location TBD" }}
                    </p>
                  </div>
                </div>

                <div
                  v-if="tournament.hasGolf || tournament.hasAccuracy || tournament.hasDistance || tournament.hasSCF || tournament.hasDiscathon || tournament.hasDDC || tournament.hasFreestyle"
                  class="card bg-base-200 md:col-span-2"
                >
                  <div class="card-body">
                    <h3 class="card-title text-base flex items-center gap-2">
                      <Icon
                        name="tabler:trophy"
                        size="20"
                      />
                      Event Types
                    </h3>
                    <EventTypesList
                      :has-golf="tournament.hasGolf"
                      :has-accuracy="tournament.hasAccuracy"
                      :has-distance="tournament.hasDistance"
                      :has-scf="tournament.hasSCF"
                      :has-discathon="tournament.hasDiscathon"
                      :has-ddc="tournament.hasDDC"
                      :has-freestyle="tournament.hasFreestyle"
                      size="md"
                      wrapper-class="flex flex-wrap gap-2"
                    />
                  </div>
                </div>
              </div>
            </div>
          </template>

          <template #contacts>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div
                v-if="hasContactData"
                class="card bg-base-200"
              >
                <div class="card-body">
                  <h3 class="card-title text-base flex items-center gap-2">
                    <Icon
                      name="tabler:user"
                      size="20"
                    />
                    Tournament Contact
                  </h3>
                  <div class="text-sm space-y-1">
                    <p v-if="tournament.contactName">
                      {{ tournament.contactName }}
                    </p>
                    <p v-if="tournament.contactEmail">
                      <a
                        :href="`mailto:${tournament.contactEmail}`"
                        class="link link-primary"
                      >{{ tournament.contactEmail }}</a>
                    </p>
                    <p v-if="tournament.contactPhone">
                      {{ tournament.contactPhone }}
                    </p>
                  </div>
                </div>
              </div>

              <div
                v-if="hasDirectorData"
                class="card bg-base-200"
              >
                <div class="card-body">
                  <h3 class="card-title text-base flex items-center gap-2">
                    <Icon
                      name="tabler:user-star"
                      size="20"
                    />
                    Tournament Director
                  </h3>
                  <div class="text-sm space-y-1">
                    <p v-if="tournament.directorName">
                      {{ tournament.directorName }}
                    </p>
                    <p v-if="tournament.directorEmail">
                      <a
                        :href="`mailto:${tournament.directorEmail}`"
                        class="link link-primary"
                      >{{ tournament.directorEmail }}</a>
                    </p>
                    <p v-if="tournament.directorPhone">
                      {{ tournament.directorPhone }}
                    </p>
                  </div>
                </div>
              </div>

              <EmptyStateAlert
                v-if="!hasContactData && !hasDirectorData"
                class="md:col-span-2"
                message="No contact information is available yet."
              />
            </div>
          </template>

          <template #map>
            <div v-if="hasMapCoordinates">
              <ClientOnly>
                <TournamentMap
                  :lat="tournament.lat"
                  :long="tournament.long"
                  :name="tournament.name"
                  :city="tournament.city"
                  :country="tournament.country"
                  :venues="tournament.venues"
                />
              </ClientOnly>
            </div>
            <div
              v-else-if="tournament.city || tournament.country"
              class="alert"
            >
              <Icon
                name="tabler:map-off"
                size="24"
              />
              <div>
                <p class="font-semibold">
                  Map location not specified
                </p>
                <p class="text-sm opacity-70">
                  Coordinates haven't been set for this tournament yet. Location: {{ [tournament.city, tournament.country].filter(Boolean).join(", ") }}
                </p>
              </div>
            </div>
            <EmptyStateAlert
              v-else
              message="No location information available yet."
            />
          </template>

          <template #venues>
            <div
              v-if="tournament.venues.length > 0"
              class="space-y-4"
            >
              <div
                v-for="(venue, index) in tournament.venues"
                :key="venue.id"
                class="rounded-box bg-base-100 border border-base-300 p-4"
              >
                <VenueListItem
                  :venue="venue"
                  :title="`${venue.name} (${index + 1})`"
                  coordinates-class="text-xs opacity-70"
                />
              </div>
            </div>
            <EmptyStateAlert
              v-else
              message="No venues have been assigned to this tournament yet."
            />
          </template>
        </VerticalTabsLayout>
      </div>

      <!-- CTA for guests -->
      <div class="alert alert-info">
        <Icon
          name="tabler:info-circle"
          size="24"
        />
        <div class="flex-1">
          <p class="font-semibold">
            Interested in participating?
          </p>
          <p class="text-sm opacity-80">
            Contact the tournament director to request an invitation. Once invited, you'll receive an email to join and access member features.
          </p>
        </div>
        <a
          v-if="tournamentDirectorEmail"
          :href="`mailto:${tournamentDirectorEmail}?subject=Tournament Participation - ${tournament.name}`"
          class="btn btn-primary btn-sm"
        >
          Contact TD
        </a>
      </div>
    </div>
  </div>
</template>
