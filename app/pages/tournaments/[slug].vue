<script setup lang="ts">
/**
 * Public tournament detail page
 * Accessible to everyone including guests
 */

import { useAuthStore } from "~/stores/auth";

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
  startDate: number | null;
  endDate: number | null;
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
const authStore = useAuthStore();

const { data: tournament, pending, error } = await useFetch<TournamentDetail>(`/api/tournaments/${slug}`);

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
</script>

<template>
  <div class="container mx-auto p-4 max-w-4xl">
    <!-- Loading State -->
    <div
      v-if="pending"
      class="flex justify-center items-center py-12"
    >
      <span class="loading loading-spinner loading-lg" />
    </div>

    <!-- Tournament Details -->
    <div v-else-if="tournament">
      <!-- Back Button and Edit Button -->
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
        <NuxtLink
          v-if="authStore.isSignedIn"
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

      <!-- Description -->
      <div
        v-if="tournament.description"
        class="prose max-w-none mb-6"
      >
        <p class="text-lg">
          {{ tournament.description }}
        </p>
      </div>

      <!-- Info Cards Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <!-- Date & Time Card -->
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

        <!-- Location Card -->
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

        <!-- Contact Card -->
        <div
          v-if="tournament.contactName || tournament.contactEmail"
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
            </div>
          </div>
        </div>

        <!-- Event Types Card -->
        <div
          v-if="tournament.hasGolf || tournament.hasAccuracy || tournament.hasDistance || tournament.hasSCF || tournament.hasDiscathon || tournament.hasDDC || tournament.hasFreestyle"
          class="card bg-base-200"
        >
          <div class="card-body">
            <h3 class="card-title text-base flex items-center gap-2">
              <Icon
                name="tabler:trophy"
                size="20"
              />
              Event Types
            </h3>
            <div class="flex flex-wrap gap-2">
              <EventTypeBadge
                v-if="tournament.hasGolf"
                type="golf"
                size="md"
              />
              <EventTypeBadge
                v-if="tournament.hasAccuracy"
                type="accuracy"
                size="md"
              />
              <EventTypeBadge
                v-if="tournament.hasDistance"
                type="distance"
                size="md"
              />
              <EventTypeBadge
                v-if="tournament.hasSCF"
                type="scf"
                size="md"
              />
              <EventTypeBadge
                v-if="tournament.hasDiscathon"
                type="discathon"
                size="md"
              />
              <EventTypeBadge
                v-if="tournament.hasDDC"
                type="ddc"
                size="md"
              />
              <EventTypeBadge
                v-if="tournament.hasFreestyle"
                type="freestyle"
                size="md"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Map Section -->
      <div
        v-if="tournament.lat != null && tournament.long != null && tournament.lat !== 0 && tournament.long !== 0"
        class="mb-6"
      >
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

      <!-- Map location not specified message -->
      <div
        v-else-if="tournament.city || tournament.country"
        class="mb-6"
      >
        <div class="alert">
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
          v-if="tournament.contactEmail"
          :href="`mailto:${tournament.contactEmail}?subject=Tournament Participation - ${tournament.name}`"
          class="btn btn-primary btn-sm"
        >
          Contact TD
        </a>
      </div>
    </div>
  </div>
</template>
