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
const venueId = computed(() => Number(route.params.id));

const { data, pending, error, refresh } = await useFetch(() => `/api/tournaments/${slug.value}/edit`);

if (error.value) {
  throw createError({
    statusCode: error.value.statusCode || 404,
    message: error.value.message || "Tournament not found",
  });
}

const venue = computed<TournamentVenue | null>(() => {
  if (!data.value || Array.isArray(data.value)) {
    return null;
  }

  const match = (data.value.venues || []).find((item: any) => Number(item.id) === venueId.value);
  if (!match) {
    return null;
  }

  return {
    id: match.id,
    name: match.name,
    description: match.description ?? null,
    facilities: match.facilities ?? null,
    lat: match.lat,
    long: match.long,
    hasGolf: !!match.hasGolf,
    hasAccuracy: !!match.hasAccuracy,
    hasDistance: !!match.hasDistance,
    hasSCF: !!match.hasSCF,
    hasDiscathon: !!match.hasDiscathon,
    hasDDC: !!match.hasDDC,
    hasFreestyle: !!match.hasFreestyle,
  };
});

const tournamentDisciplineEnabled = computed(() => {
  if (!data.value || Array.isArray(data.value)) {
    return {
      hasGolf: true,
      hasAccuracy: true,
      hasDistance: true,
      hasSCF: true,
      hasDiscathon: true,
      hasDDC: true,
      hasFreestyle: true,
    };
  }

  return {
    hasGolf: !!data.value.hasGolf,
    hasAccuracy: !!data.value.hasAccuracy,
    hasDistance: !!data.value.hasDistance,
    hasSCF: !!data.value.hasSCF,
    hasDiscathon: !!data.value.hasDiscathon,
    hasDDC: !!data.value.hasDDC,
    hasFreestyle: !!data.value.hasFreestyle,
  };
});

const form = reactive({
  id: 0,
  name: "",
  description: "",
  facilities: "",
  lat: 0,
  long: 0,
  hasGolf: false,
  hasAccuracy: false,
  hasDistance: false,
  hasSCF: false,
  hasDiscathon: false,
  hasDDC: false,
  hasFreestyle: false,
});

const saveError = ref<string | null>(null);
const saveSuccess = ref<string | null>(null);
const saving = ref(false);

watch(
  venue,
  (value) => {
    if (!value) {
      return;
    }

    form.id = value.id;
    form.name = value.name || "";
    form.description = value.description || "";
    form.facilities = value.facilities || "";
    form.lat = value.lat;
    form.long = value.long;
    form.hasGolf = value.hasGolf;
    form.hasAccuracy = value.hasAccuracy;
    form.hasDistance = value.hasDistance;
    form.hasSCF = value.hasSCF;
    form.hasDiscathon = value.hasDiscathon;
    form.hasDDC = value.hasDDC;
    form.hasFreestyle = value.hasFreestyle;
  },
  { immediate: true },
);

function roundCoord(value: number) {
  return Number(value.toFixed(6));
}

function onVenueMapClick(event: any) {
  const { lat, lng } = event.latlng;
  form.lat = roundCoord(lat);
  form.long = roundCoord(lng);
}

async function saveVenue() {
  if (!form.name.trim()) {
    saveError.value = "Venue name is required.";
    return;
  }

  if (!Number.isFinite(form.lat) || !Number.isFinite(form.long)) {
    saveError.value = "Latitude and longitude are required.";
    return;
  }

  saving.value = true;
  saveError.value = null;
  saveSuccess.value = null;
  try {
    await $fetch(`/api/tournaments/${slug.value}/venues/upsert`, {
      method: "POST",
      body: {
        id: form.id,
        name: form.name.trim(),
        description: form.description || null,
        facilities: form.facilities || null,
        lat: form.lat,
        long: form.long,
        hasGolf: form.hasGolf,
        hasAccuracy: form.hasAccuracy,
        hasDistance: form.hasDistance,
        hasSCF: form.hasSCF,
        hasDiscathon: form.hasDiscathon,
        hasDDC: form.hasDDC,
        hasFreestyle: form.hasFreestyle,
      },
    });

    saveSuccess.value = "Venue saved.";
    await refresh();
    await refreshNuxtData();
  }
  catch (err: any) {
    saveError.value = err?.data?.message || err?.message || "Failed to save venue";
  }
  finally {
    saving.value = false;
  }
}
</script>

<template>
  <div>
    <FormHeader
      :title="venue ? `Edit ${venue.name}` : `Venue #${venueId}`"
      description="Update venue details and tournament-specific discipline availability."
      title-tag="h1"
      title-class="text-2xl font-bold"
      description-class="text-sm opacity-70"
      wrapper-class="mb-3"
    />

    <PageLoadingState
      v-if="pending"
      wrapper-class="py-8"
    />

    <EmptyStateAlert
      v-else-if="!venue"
      message="Venue not found in this tournament."
      alert-class="alert alert-warning"
    />

    <div
      v-else
      class="space-y-3"
    >
      <div
        v-if="saveError"
        class="alert alert-error py-2"
      >
        <span class="text-sm">{{ saveError }}</span>
      </div>

      <div
        v-if="saveSuccess"
        class="alert alert-success py-2"
      >
        <span class="text-sm">{{ saveSuccess }}</span>
      </div>

      <div class="card bg-base-200 border border-base-300/60">
        <div class="card-body space-y-3">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <VenueEditorFields
              v-model="form"
              :tournament-discipline-enabled="tournamentDisciplineEnabled"
              map-hint="Click map to set this venue location"
              @map-click="onVenueMapClick"
            />
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <NuxtLink
              :to="`/dashboard/tournaments/${slug}/venues`"
              class="btn btn-sm btn-ghost"
            >
              Discard
            </NuxtLink>
            <button
              class="btn btn-sm btn-primary"
              type="button"
              :disabled="saving"
              @click="saveVenue"
            >
              <span v-if="saving" class="loading loading-spinner loading-xs" />
              <span v-else>Save for tournament</span>
            </button>
            <NuxtLink
              :to="`/dashboard/tournaments/${slug}/venues`"
              class="btn btn-sm btn-outline"
            >
              Back to all venues
            </NuxtLink>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
