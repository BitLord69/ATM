<script setup lang="ts">
import { LMap, LMarker, LPopup, LTileLayer } from "@vue-leaflet/vue-leaflet";
import "leaflet/dist/leaflet.css";

import { editTournamentBodySchema } from "#shared/schemas/tournament-edit";

definePageMeta({
  ssr: false,
});

type EditableVenue = {
  id?: number;
  key: string;
  name: string;
  description: string;
  facilities: string;
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

type ExistingVenue = {
  id: number;
  name: string;
  description: string | null;
  facilities: string | null;
  lat: number;
  long: number;
};

const route = useRoute();
const router = useRouter();
const slug = computed(() => route.params.slug as string);

const { data, pending, error, refresh } = await useFetch(() => `/api/tournaments/${slug.value}/edit`);

if (error.value) {
  throw createError({
    statusCode: error.value.statusCode || 404,
    message: error.value.message || "Tournament not found",
  });
}

const form = reactive({
  name: "",
  slug: "",
  description: "",
  country: "",
  city: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  lat: 0,
  long: 0,
  startDate: "",
  endDate: "",
  hasGolf: false,
  hasAccuracy: false,
  hasDistance: false,
  hasSCF: false,
  hasDiscathon: false,
  hasDDC: false,
  hasFreestyle: false,
});

const venues = ref<EditableVenue[]>([]);
const selectedExistingVenueId = ref<string>("");
const saveError = ref<string | null>(null);
const saveSuccess = ref<string | null>(null);
const validationMessages = ref<string[]>([]);
const fieldErrors = ref<Record<string, string>>({});
const touchedFields = ref<Record<string, boolean>>({});
const submitAttempted = ref(false);
const saving = ref(false);
const initialSnapshot = ref("");
const hasLoadedInitialState = ref(false);
let successTimeout: ReturnType<typeof setTimeout> | null = null;

function createSnapshot() {
  return JSON.stringify({
    form: {
      name: form.name,
      slug: form.slug,
      description: form.description,
      country: form.country,
      city: form.city,
      contactName: form.contactName,
      contactEmail: form.contactEmail,
      contactPhone: form.contactPhone,
      lat: form.lat,
      long: form.long,
      startDate: form.startDate,
      endDate: form.endDate,
      hasGolf: form.hasGolf,
      hasAccuracy: form.hasAccuracy,
      hasDistance: form.hasDistance,
      hasSCF: form.hasSCF,
      hasDiscathon: form.hasDiscathon,
      hasDDC: form.hasDDC,
      hasFreestyle: form.hasFreestyle,
    },
    venues: venues.value.map(v => ({
      id: v.id ?? null,
      name: v.name,
      description: v.description,
      facilities: v.facilities,
      lat: v.lat,
      long: v.long,
      hasGolf: v.hasGolf,
      hasAccuracy: v.hasAccuracy,
      hasDistance: v.hasDistance,
      hasSCF: v.hasSCF,
      hasDiscathon: v.hasDiscathon,
      hasDDC: v.hasDDC,
      hasFreestyle: v.hasFreestyle,
    })),
  });
}

const hasUnsavedChanges = computed(() => {
  if (!hasLoadedInitialState.value) {
    return false;
  }
  return createSnapshot() !== initialSnapshot.value;
});

function toDateInput(timestamp: number | null | undefined) {
  if (!timestamp) {
    return "";
  }
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromDateInput(value: string): number | null {
  if (!value) {
    return null;
  }
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

function roundCoord(value: number) {
  return Number(value.toFixed(6));
}

function markTouched(path: string) {
  touchedFields.value[path] = true;
}

function shouldShowFieldError(path: string) {
  return !!fieldErrors.value[path] && (submitAttempted.value || touchedFields.value[path]);
}

function getFieldError(path: string) {
  return shouldShowFieldError(path) ? fieldErrors.value[path] : "";
}

function addVenue() {
  venues.value.push({
    key: crypto.randomUUID(),
    name: "",
    description: "",
    facilities: "",
    lat: form.lat || 0,
    long: form.long || 0,
    hasGolf: false,
    hasAccuracy: false,
    hasDistance: false,
    hasSCF: false,
    hasDiscathon: false,
    hasDDC: false,
    hasFreestyle: false,
  });
}

const availableVenues = computed<ExistingVenue[]>(() => {
  if (!data.value || Array.isArray(data.value)) {
    return [];
  }
  return (data.value.availableVenues || []) as ExistingVenue[];
});

const unlinkedAvailableVenues = computed(() => {
  const linkedIds = new Set(venues.value.map(v => v.id).filter((id): id is number => typeof id === "number"));
  return availableVenues.value.filter(v => !linkedIds.has(v.id));
});

function addExistingVenue() {
  const id = Number(selectedExistingVenueId.value);
  if (!id || Number.isNaN(id)) {
    return;
  }

  const existing = unlinkedAvailableVenues.value.find(v => v.id === id);
  if (!existing) {
    return;
  }

  venues.value.push({
    id: existing.id,
    key: `existing-${existing.id}-${Date.now()}`,
    name: existing.name,
    description: existing.description || "",
    facilities: existing.facilities || "",
    lat: existing.lat,
    long: existing.long,
    hasGolf: false,
    hasAccuracy: false,
    hasDistance: false,
    hasSCF: false,
    hasDiscathon: false,
    hasDDC: false,
    hasFreestyle: false,
  });

  selectedExistingVenueId.value = "";
}

function removeVenue(index: number) {
  venues.value.splice(index, 1);
}

function onTournamentMapClick(event: any) {
  const { lat, lng } = event.latlng;
  form.lat = roundCoord(lat);
  form.long = roundCoord(lng);
}

function onVenueMapClick(event: any, index: number) {
  const venue = venues.value[index];
  if (!venue) {
    return;
  }
  const { lat, lng } = event.latlng;
  venue.lat = roundCoord(lat);
  venue.long = roundCoord(lng);
}

const tournamentCenter = computed<[number, number]>(() => {
  if (typeof form.lat === "number" && typeof form.long === "number" && form.lat !== 0 && form.long !== 0) {
    return [form.lat, form.long];
  }
  return [59.67497, 12.85981];
});

watch(
  data,
  (value) => {
    if (!value || Array.isArray(value)) {
      return;
    }

    form.name = value.name || "";
    form.slug = value.slug || "";
    form.description = value.description || "";
    form.country = value.country || "";
    form.city = value.city || "";
    form.contactName = value.contactName || "";
    form.contactEmail = value.contactEmail || "";
    form.contactPhone = value.contactPhone || "";
    form.lat = value.lat || 0;
    form.long = value.long || 0;
    form.startDate = toDateInput(value.startDate);
    form.endDate = toDateInput(value.endDate);
    form.hasGolf = !!value.hasGolf;
    form.hasAccuracy = !!value.hasAccuracy;
    form.hasDistance = !!value.hasDistance;
    form.hasSCF = !!value.hasSCF;
    form.hasDiscathon = !!value.hasDiscathon;
    form.hasDDC = !!value.hasDDC;
    form.hasFreestyle = !!value.hasFreestyle;

    venues.value = (value.venues || []).map((v: any) => ({
      id: v.id,
      key: String(v.id),
      name: v.name || "",
      description: v.description || "",
      facilities: v.facilities || "",
      lat: v.lat || 0,
      long: v.long || 0,
      hasGolf: !!v.hasGolf,
      hasAccuracy: !!v.hasAccuracy,
      hasDistance: !!v.hasDistance,
      hasSCF: !!v.hasSCF,
      hasDiscathon: !!v.hasDiscathon,
      hasDDC: !!v.hasDDC,
      hasFreestyle: !!v.hasFreestyle,
    }));

    initialSnapshot.value = createSnapshot();
    hasLoadedInitialState.value = true;
  },
  { immediate: true },
);

async function saveTournament(closeTournament = false) {
  saveError.value = null;
  saveSuccess.value = null;
  validationMessages.value = [];
  submitAttempted.value = true;
  saving.value = true;

  const requestBody = {
    name: form.name,
    description: form.description || null,
    country: form.country || null,
    city: form.city || null,
    contactName: form.contactName || null,
    contactEmail: form.contactEmail || null,
    contactPhone: form.contactPhone || null,
    lat: form.lat,
    long: form.long,
    startDate: fromDateInput(form.startDate),
    endDate: fromDateInput(form.endDate),
    hasGolf: form.hasGolf,
    hasAccuracy: form.hasAccuracy,
    hasDistance: form.hasDistance,
    hasSCF: form.hasSCF,
    hasDiscathon: form.hasDiscathon,
    hasDDC: form.hasDDC,
    hasFreestyle: form.hasFreestyle,
    closeTournament,
    venues: venues.value.map(v => ({
      id: v.id,
      name: v.name,
      description: v.description || null,
      facilities: v.facilities || null,
      lat: v.lat,
      long: v.long,
      hasGolf: v.hasGolf,
      hasAccuracy: v.hasAccuracy,
      hasDistance: v.hasDistance,
      hasSCF: v.hasSCF,
      hasDiscathon: v.hasDiscathon,
      hasDDC: v.hasDDC,
      hasFreestyle: v.hasFreestyle,
    })),
  };

  const validation = editTournamentBodySchema.safeParse(requestBody);
  if (!validation.success) {
    fieldErrors.value = {};
    for (const issue of validation.error.issues) {
      const path = issue.path.join(".");
      if (path && !fieldErrors.value[path]) {
        fieldErrors.value[path] = issue.message;
      }
    }

    validationMessages.value = validation.error.issues.map((issue) => {
      const path = issue.path.length ? `${issue.path.join(".")}: ` : "";
      return `${path}${issue.message}`;
    });
    saving.value = false;
    return;
  }

  fieldErrors.value = {};

  try {
    const result = await $fetch<{ success: boolean; slug: string }>(`/api/tournaments/${slug.value}/edit`, {
      method: "PATCH",
      body: requestBody,
    });

    saveSuccess.value = closeTournament ? "Tournament closed." : "Tournament saved.";

    if (successTimeout) {
      clearTimeout(successTimeout);
    }
    successTimeout = setTimeout(() => {
      saveSuccess.value = null;
      successTimeout = null;
    }, 4000);

    if (result.slug && result.slug !== slug.value) {
      await router.replace(`/dashboard/tournaments/${result.slug}/edit`);
    }
    await refresh();
  }
  catch (err: any) {
    saveError.value = err?.data?.message || err?.message || "Failed to save tournament";
  }
  finally {
    saving.value = false;
  }
}

onBeforeRouteLeave(() => {
  // eslint-disable-next-line no-alert
  if (hasUnsavedChanges.value && !window.confirm("You have unsaved changes. Leave this page?")) {
    return false;
  }
});

function handleBeforeUnload(event: BeforeUnloadEvent) {
  if (!hasUnsavedChanges.value) {
    return;
  }
  event.preventDefault();
  event.returnValue = "";
}

onMounted(() => {
  window.addEventListener("beforeunload", handleBeforeUnload);
});

onBeforeUnmount(() => {
  window.removeEventListener("beforeunload", handleBeforeUnload);
});
</script>

<template>
  <div class="container mx-auto max-w-6xl p-4 md:p-6">
    <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
      <NuxtLink
        to="/dashboard"
        class="btn btn-ghost btn-sm"
      >
        ← Back to Dashboard
      </NuxtLink>
      <NuxtLink
        :to="`/tournaments/${form.slug || slug}`"
        class="btn btn-outline btn-sm"
      >
        View Public Page
      </NuxtLink>
    </div>

    <div
      v-if="pending"
      class="flex justify-center py-12"
    >
      <span class="loading loading-spinner loading-lg" />
    </div>

    <div
      v-else-if="data && !Array.isArray(data)"
      class="space-y-6"
    >
      <div>
        <h1 class="text-3xl font-bold">
          Edit Tournament
        </h1>
        <p class="text-sm opacity-70 mt-1">
          Update tournament details and venues. The slug remains permanent after creation.
        </p>
      </div>

      <div
        v-if="saveError"
        class="alert alert-error gap-2"
      >
        <button
          class="btn btn-ghost btn-xs"
          @click="saveError = null"
        >
          ✕
        </button>
        <span>{{ saveError }}</span>
      </div>
      <div
        v-if="validationMessages.length > 0"
        class="alert alert-warning gap-2"
      >
        <button
          class="btn btn-ghost btn-xs"
          @click="validationMessages = []"
        >
          ✕
        </button>
        <div>
          <p class="font-semibold mb-1">
            Please fix the following:
          </p>
          <ul class="list-disc list-inside text-sm">
            <li
              v-for="(message, index) in validationMessages"
              :key="index"
            >
              {{ message }}
            </li>
          </ul>
        </div>
      </div>
      <div
        v-if="saveSuccess"
        class="alert alert-success gap-2"
      >
        <button
          class="btn btn-ghost btn-xs"
          @click="saveSuccess = null"
        >
          ✕
        </button>
        <span>{{ saveSuccess }}</span>
      </div>

      <div class="card bg-base-200 shadow-sm border border-base-300/60">
        <div class="card-body">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              label="Tournament Name"
              required
              :error="getFieldError('name')"
            >
              <input
                v-model="form.name"
                class="input input-bordered w-full"
                :class="{ 'input-error': shouldShowFieldError('name') }"
                type="text"
                required
                :aria-invalid="shouldShowFieldError('name')"
                @blur="markTouched('name')"
              >
            </FormField>
            <FormField label="Slug">
              <input
                v-model="form.slug"
                class="input input-bordered w-full bg-base-300 text-base-content cursor-not-allowed opacity-70"
                type="text"
                readonly
                title="Slug cannot be changed"
              >
            </FormField>
            <FormField
              label="Description"
              wrapper-class="md:col-span-2"
            >
              <textarea
                v-model="form.description"
                class="textarea textarea-bordered w-full"
                rows="3"
              />
            </FormField>
            <FormField label="Country">
              <input
                v-model="form.country"
                class="input input-bordered w-full"
                type="text"
              >
            </FormField>
            <FormField label="City">
              <input
                v-model="form.city"
                class="input input-bordered w-full"
                type="text"
              >
            </FormField>
            <FormField label="Start Date">
              <input
                v-model="form.startDate"
                class="input input-bordered w-full"
                type="date"
              >
            </FormField>
            <FormField label="End Date">
              <input
                v-model="form.endDate"
                class="input input-bordered w-full"
                type="date"
              >
            </FormField>
            <FormField label="Contact Name">
              <input
                v-model="form.contactName"
                class="input input-bordered w-full"
                type="text"
              >
            </FormField>
            <FormField label="Contact Email">
              <input
                v-model="form.contactEmail"
                class="input input-bordered w-full"
                type="email"
              >
            </FormField>
            <FormField
              label="Contact Phone"
              wrapper-class="md:col-span-2"
            >
              <input
                v-model="form.contactPhone"
                class="input input-bordered w-full"
                type="text"
              >
            </FormField>
          </div>

          <div class="rounded-box bg-base-100 p-3 md:p-4 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mt-2 border border-base-300/50">
            <ToggleField v-model="form.hasGolf" label="Golf" />
            <ToggleField v-model="form.hasAccuracy" label="Accuracy" />
            <ToggleField v-model="form.hasDistance" label="Distance" />
            <ToggleField v-model="form.hasSCF" label="SCF" />
            <ToggleField v-model="form.hasDiscathon" label="Discathon" />
            <ToggleField v-model="form.hasDDC" label="DDC" />
            <ToggleField v-model="form.hasFreestyle" label="Freestyle" />
          </div>
        </div>
      </div>

      <div class="card bg-base-200 shadow-sm border border-base-300/60">
        <div class="card-body">
          <h2 class="card-title">
            Tournament Location (click map to set)
          </h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <FormField
              label="Latitude"
              required
              :error="getFieldError('lat')"
            >
              <input
                v-model.number="form.lat"
                class="input input-bordered w-full"
                :class="{ 'input-error': shouldShowFieldError('lat') }"
                type="number"
                step="0.000001"
                required
                :aria-invalid="shouldShowFieldError('lat')"
                @blur="markTouched('lat')"
              >
            </FormField>
            <FormField
              label="Longitude"
              required
              :error="getFieldError('long')"
            >
              <input
                v-model.number="form.long"
                class="input input-bordered w-full"
                :class="{ 'input-error': shouldShowFieldError('long') }"
                type="number"
                step="0.000001"
                required
                :aria-invalid="shouldShowFieldError('long')"
                @blur="markTouched('long')"
              >
            </FormField>
          </div>

          <ClientOnly>
            <LMap
              :zoom="form.lat && form.long ? 10 : 4"
              :center="tournamentCenter"
              style="height: 360px; z-index: 0;"
              @click="onTournamentMapClick"
            >
              <LTileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors"
              />
              <LMarker :lat-lng="[form.lat, form.long]">
                <LPopup>Tournament location</LPopup>
              </LMarker>
            </LMap>
          </ClientOnly>
        </div>
      </div>

      <div class="card bg-base-200 shadow-sm border border-base-300/60">
        <div class="card-body">
          <div class="flex justify-between items-center">
            <h2 class="card-title">
              Venues
            </h2>
            <div class="flex items-center gap-2">
              <select
                v-model="selectedExistingVenueId"
                class="select select-bordered select-sm"
              >
                <option value="">
                  Reuse existing venue...
                </option>
                <option
                  v-for="existing in unlinkedAvailableVenues"
                  :key="existing.id"
                  :value="String(existing.id)"
                >
                  {{ existing.name }} ({{ existing.lat.toFixed(3) }}, {{ existing.long.toFixed(3) }})
                </option>
              </select>
              <button
                class="btn btn-sm btn-outline"
                type="button"
                :disabled="!selectedExistingVenueId"
                @click="addExistingVenue"
              >
                Add Existing
              </button>
              <button
                class="btn btn-sm btn-primary"
                type="button"
                @click="addVenue"
              >
                + Add Venue
              </button>
            </div>
          </div>

          <div
            v-if="venues.length === 0"
            class="alert"
          >
            <span>No venues yet.</span>
          </div>

          <div class="space-y-6">
            <div
              v-for="(venue, index) in venues"
              :key="venue.key"
              class="card bg-base-100 border border-base-300"
            >
              <div class="card-body grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="md:col-span-2 flex justify-between items-center">
                  <h3 class="font-semibold">
                    Venue {{ index + 1 }}
                  </h3>
                  <button
                    class="btn btn-sm btn-error btn-outline"
                    type="button"
                    @click="removeVenue(index)"
                  >
                    Remove
                  </button>
                </div>

                <FormField
                  label="Venue Name"
                  required
                  wrapper-class="md:col-span-2"
                  :error="getFieldError(`venues.${index}.name`)"
                >
                  <input
                    v-model="venue.name"
                    class="input input-bordered w-full"
                    :class="{ 'input-error': shouldShowFieldError(`venues.${index}.name`) }"
                    type="text"
                    required
                    :aria-invalid="shouldShowFieldError(`venues.${index}.name`)"
                    @blur="markTouched(`venues.${index}.name`)"
                  >
                </FormField>
                <FormField
                  label="Description"
                  wrapper-class="md:col-span-2"
                >
                  <textarea
                    v-model="venue.description"
                    class="textarea textarea-bordered w-full"
                    rows="2"
                  />
                </FormField>
                <FormField
                  label="Facilities"
                  wrapper-class="md:col-span-2"
                >
                  <input
                    v-model="venue.facilities"
                    class="input input-bordered w-full"
                    type="text"
                  >
                </FormField>

                <!-- Disciplines for this venue -->
                <div class="md:col-span-2">
                  <p class="label-text mb-2">
                    Disciplines at this venue
                  </p>
                  <div class="rounded-box bg-base-100 p-3 md:p-4 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 border border-base-300/50">
                    <ToggleField
                      v-model="venue.hasGolf"
                      label="Golf"
                      :disabled="!form.hasGolf"
                      :tooltip="!form.hasGolf ? 'Enable Golf at tournament level first.' : ''"
                    />
                    <ToggleField
                      v-model="venue.hasAccuracy"
                      label="Accuracy"
                      :disabled="!form.hasAccuracy"
                      :tooltip="!form.hasAccuracy ? 'Enable Accuracy at tournament level first.' : ''"
                    />
                    <ToggleField
                      v-model="venue.hasDistance"
                      label="Distance"
                      :disabled="!form.hasDistance"
                      :tooltip="!form.hasDistance ? 'Enable Distance at tournament level first.' : ''"
                    />
                    <ToggleField
                      v-model="venue.hasSCF"
                      label="SCF"
                      :disabled="!form.hasSCF"
                      :tooltip="!form.hasSCF ? 'Enable SCF at tournament level first.' : ''"
                    />
                    <ToggleField
                      v-model="venue.hasDiscathon"
                      label="Discathon"
                      :disabled="!form.hasDiscathon"
                      :tooltip="!form.hasDiscathon ? 'Enable Discathon at tournament level first.' : ''"
                    />
                    <ToggleField
                      v-model="venue.hasDDC"
                      label="DDC"
                      :disabled="!form.hasDDC"
                      :tooltip="!form.hasDDC ? 'Enable DDC at tournament level first.' : ''"
                    />
                    <ToggleField
                      v-model="venue.hasFreestyle"
                      label="Freestyle"
                      :disabled="!form.hasFreestyle"
                      :tooltip="!form.hasFreestyle ? 'Enable Freestyle at tournament level first.' : ''"
                    />
                  </div>
                </div>

                <FormField
                  label="Latitude"
                  required
                  :error="getFieldError(`venues.${index}.lat`)"
                >
                  <input
                    v-model.number="venue.lat"
                    class="input input-bordered w-full"
                    :class="{ 'input-error': shouldShowFieldError(`venues.${index}.lat`) }"
                    type="number"
                    step="0.000001"
                    required
                    :aria-invalid="shouldShowFieldError(`venues.${index}.lat`)"
                    @blur="markTouched(`venues.${index}.lat`)"
                  >
                </FormField>
                <FormField
                  label="Longitude"
                  required
                  :error="getFieldError(`venues.${index}.long`)"
                >
                  <input
                    v-model.number="venue.long"
                    class="input input-bordered w-full"
                    :class="{ 'input-error': shouldShowFieldError(`venues.${index}.long`) }"
                    type="number"
                    step="0.000001"
                    required
                    :aria-invalid="shouldShowFieldError(`venues.${index}.long`)"
                    @blur="markTouched(`venues.${index}.long`)"
                  >
                </FormField>

                <div class="md:col-span-2">
                  <p class="text-sm opacity-70 mb-2">
                    Click map to set this venue location
                  </p>
                  <ClientOnly>
                    <LMap
                      :zoom="venue.lat && venue.long ? 12 : 5"
                      :center="(venue.lat && venue.long) ? [venue.lat, venue.long] : tournamentCenter"
                      style="height: 250px; z-index: 0;"
                      @click="onVenueMapClick($event, index)"
                    >
                      <LTileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution="&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors"
                      />
                      <LMarker :lat-lng="[venue.lat, venue.long]">
                        <LPopup>{{ venue.name || `Venue ${index + 1}` }}</LPopup>
                      </LMarker>
                    </LMap>
                  </ClientOnly>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="flex justify-end gap-2">
        <NuxtLink
          to="/dashboard"
          class="btn btn-ghost"
        >
          Cancel
        </NuxtLink>
        <button
          class="btn btn-primary"
          :disabled="saving"
          @click="saveTournament(false)"
        >
          <span
            v-if="saving"
            class="loading loading-spinner loading-sm"
          />
          <span v-else>Save Tournament</span>
        </button>
      </div>
    </div>
  </div>
</template>
