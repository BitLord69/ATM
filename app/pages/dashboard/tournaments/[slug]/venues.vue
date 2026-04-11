<script setup lang="ts">
definePageMeta({ ssr: false, layout: "tournament-admin" });

type TournamentVenue = {
  id: number;
  name: string;
  description: string | null;
  facilities: string | null;
  lat: number;
  long: number;
  hasGolf: boolean;
  hasAccuracy: boolean;
  hasDistance: boolean;
  hasSCF: boolean;
  hasDiscathon: boolean;
  hasDDC: boolean;
  hasFreestyle: boolean;
};

const route = useRoute();
const slug = computed(() => route.params.slug as string);
const selectedVenueRadiusKm = ref(300);

const { data, pending, error } = await useFetch(() => `/api/tournaments/${slug.value}/edit`, {
  query: {
    radiusKm: selectedVenueRadiusKm,
  },
  watch: [selectedVenueRadiusKm],
});

if (error.value) {
  throw createError({
    statusCode: error.value.statusCode || 404,
    message: error.value.message || "Tournament not found",
  });
}

const venues = computed<TournamentVenue[]>(() => {
  if (!data.value || Array.isArray(data.value)) {
    return [];
  }

  return (data.value.venues || []).map((venue: any) => ({
    id: venue.id,
    name: venue.name,
    description: venue.description ?? null,
    facilities: venue.facilities ?? null,
    lat: venue.lat,
    long: venue.long,
    hasGolf: !!venue.hasGolf,
    hasAccuracy: !!venue.hasAccuracy,
    hasDistance: !!venue.hasDistance,
    hasSCF: !!venue.hasSCF,
    hasDiscathon: !!venue.hasDiscathon,
    hasDDC: !!venue.hasDDC,
    hasFreestyle: !!venue.hasFreestyle,
  }));
});
</script>

<template>
  <div>
    <FormHeader
      title="Venues"
      title-tag="h1"
      title-class="text-2xl font-bold"
      wrapper-class="mb-3"
    />

    <div class="space-y-3">
      <div class="rounded-box border border-base-300/60 bg-base-100 p-3">
        <div class="flex items-center gap-2">
          <NuxtLink
            :to="`/dashboard/tournaments/${slug}/edit?tab=general&section=venues-section`"
            class="btn btn-sm btn-primary"
          >
            Add Venue
          </NuxtLink>
        </div>
      </div>

      <PageLoadingState
        v-if="pending"
        wrapper-class="py-8"
      />

      <EmptyStateAlert
        v-else-if="venues.length === 0"
        message="No venues linked yet."
      />

      <div
        v-else
        class="grid grid-cols-1 lg:grid-cols-2 gap-3"
      >
        <div
          v-for="venue in venues"
          :key="venue.id"
          class="rounded-box border border-base-300 bg-base-100 p-3"
        >
          <div class="flex items-center justify-between gap-2 mb-2">
            <h3 class="font-semibold">
              {{ venue.name }}
            </h3>
            <NuxtLink
              :to="`/dashboard/tournaments/${slug}/venue/${venue.id}`"
              class="btn btn-xs btn-outline"
            >
              Edit
            </NuxtLink>
          </div>
          <VenueListItem
            :venue="venue"
          >
            <div class="flex flex-wrap gap-2 mt-2">
              <span v-if="venue.hasGolf" class="badge badge-outline">Disc golf</span>
              <span v-if="venue.hasAccuracy" class="badge badge-outline">Accuracy</span>
              <span v-if="venue.hasDistance" class="badge badge-outline">Distance</span>
              <span v-if="venue.hasSCF" class="badge badge-outline">SCF</span>
              <span v-if="venue.hasDiscathon" class="badge badge-outline">Discathon</span>
              <span v-if="venue.hasDDC" class="badge badge-outline">DDC</span>
              <span v-if="venue.hasFreestyle" class="badge badge-outline">Freestyle</span>
            </div>
          </VenueListItem>
        </div>
      </div>
    </div>
  </div>
</template>
