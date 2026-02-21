<script setup lang="ts">
/**
 * Public tournament detail page
 * Accessible to everyone including guests
 */

const route = useRoute();
const slug = route.params.slug as string;

const { data: tournament, pending, error } = await useFetch(`/api/tournaments/${slug}`);

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
    <div v-else-if="tournament && !Array.isArray(tournament)">
      <!-- Back Button -->
      <div class="mb-4">
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
                size="sm"
              />
              <EventTypeBadge
                v-if="tournament.hasAccuracy"
                type="accuracy"
                size="sm"
              />
              <EventTypeBadge
                v-if="tournament.hasDistance"
                type="distance"
                size="sm"
              />
              <EventTypeBadge
                v-if="tournament.hasSCF"
                type="scf"
                size="sm"
              />
              <EventTypeBadge
                v-if="tournament.hasDiscathon"
                type="discathon"
                size="sm"
              />
              <EventTypeBadge
                v-if="tournament.hasDDC"
                type="ddc"
                size="sm"
              />
              <EventTypeBadge
                v-if="tournament.hasFreestyle"
                type="freestyle"
                size="sm"
              />
            </div>
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
