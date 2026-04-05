<script setup lang="ts">
const props = withDefaults(defineProps<{
  tournamentDisciplineEnabled: DisciplineEnabledState;
  disableGlobalFields?: boolean;
  mapHint?: string;
  fallbackCenter?: [number, number];
}>(), {
  disableGlobalFields: false,
  mapHint: "Click map to set this venue location",
  fallbackCenter: () => [59.67497, 12.85981],
});
const emit = defineEmits<{
  (event: "mapClick", value: any): void;
}>();
const LMap = defineAsyncComponent(() => import("@vue-leaflet/vue-leaflet").then(module => module.LMap));
const LMarker = defineAsyncComponent(() => import("@vue-leaflet/vue-leaflet").then(module => module.LMarker));
const LPopup = defineAsyncComponent(() => import("@vue-leaflet/vue-leaflet").then(module => module.LPopup));
const LTileLayer = defineAsyncComponent(() => import("@vue-leaflet/vue-leaflet").then(module => module.LTileLayer));

type VenueEditorModel = {
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

type DisciplineEnabledState = {
  hasGolf: boolean;
  hasAccuracy: boolean;
  hasDistance: boolean;
  hasSCF: boolean;
  hasDiscathon: boolean;
  hasDDC: boolean;
  hasFreestyle: boolean;
};

const model = defineModel<VenueEditorModel>({ required: true });

const mapCenter = computed<[number, number]>(() => {
  if (model.value.lat && model.value.long) {
    return [model.value.lat, model.value.long];
  }
  return props.fallbackCenter;
});
</script>

<template>
  <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
    <FormField
      label="Venue name"
      required
    >
      <input
        v-model="model.name"
        class="input input-bordered w-full"
        type="text"
        :disabled="disableGlobalFields"
        required
      >
    </FormField>
    <FormField
      label="Facilities"
    >
      <input
        v-model="model.facilities"
        class="input input-bordered w-full"
        type="text"
        :disabled="disableGlobalFields"
      >
    </FormField>
    <FormField
      label="Description"
      wrapper-class="md:col-span-2"
    >
      <textarea
        v-model="model.description"
        class="textarea textarea-bordered w-full"
        rows="2"
        :disabled="disableGlobalFields"
      />
    </FormField>

    <div class="md:col-span-2">
      <p class="label-text mb-1">
        Disciplines at this venue
      </p>
      <div class="rounded-box bg-base-100 p-2 md:p-3 grid grid-cols-3 md:grid-cols-4 gap-2 md:gap-3 border border-base-300/50">
        <ToggleField
          v-model="model.hasGolf"
          label="Disc golf"
          :disabled="!tournamentDisciplineEnabled.hasGolf"
          :tooltip="!tournamentDisciplineEnabled.hasGolf ? 'Enable Disc golf at tournament level first.' : ''"
        />
        <ToggleField
          v-model="model.hasAccuracy"
          label="Accuracy"
          :disabled="!tournamentDisciplineEnabled.hasAccuracy"
          :tooltip="!tournamentDisciplineEnabled.hasAccuracy ? 'Enable Accuracy at tournament level first.' : ''"
        />
        <ToggleField
          v-model="model.hasDistance"
          label="Distance"
          :disabled="!tournamentDisciplineEnabled.hasDistance"
          :tooltip="!tournamentDisciplineEnabled.hasDistance ? 'Enable Distance at tournament level first.' : ''"
        />
        <ToggleField
          v-model="model.hasSCF"
          label="SCF"
          :disabled="!tournamentDisciplineEnabled.hasSCF"
          :tooltip="!tournamentDisciplineEnabled.hasSCF ? 'Enable SCF at tournament level first.' : ''"
        />
        <ToggleField
          v-model="model.hasDiscathon"
          label="Discathon"
          :disabled="!tournamentDisciplineEnabled.hasDiscathon"
          :tooltip="!tournamentDisciplineEnabled.hasDiscathon ? 'Enable Discathon at tournament level first.' : ''"
        />
        <ToggleField
          v-model="model.hasDDC"
          label="DDC"
          :disabled="!tournamentDisciplineEnabled.hasDDC"
          :tooltip="!tournamentDisciplineEnabled.hasDDC ? 'Enable DDC at tournament level first.' : ''"
        />
        <ToggleField
          v-model="model.hasFreestyle"
          label="Freestyle"
          :disabled="!tournamentDisciplineEnabled.hasFreestyle"
          :tooltip="!tournamentDisciplineEnabled.hasFreestyle ? 'Enable Freestyle at tournament level first.' : ''"
        />
      </div>
    </div>

    <FormField label="Latitude" required>
      <input
        v-model.number="model.lat"
        class="input input-bordered w-full"
        type="number"
        step="0.000001"
        :disabled="disableGlobalFields"
        required
      >
    </FormField>
    <FormField label="Longitude" required>
      <input
        v-model.number="model.long"
        class="input input-bordered w-full"
        type="number"
        step="0.000001"
        :disabled="disableGlobalFields"
        required
      >
    </FormField>

    <div class="md:col-span-2">
      <p class="text-sm opacity-70 mb-1">
        {{ mapHint }}
      </p>
      <ClientOnly>
        <LMap
          :zoom="model.lat && model.long ? 12 : 5"
          :center="mapCenter"
          style="height: 220px; z-index: 0;"
          @click="emit('mapClick', $event)"
        >
          <LTileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
            attribution="Tiles &copy; <a href='https://www.esri.com/'>Esri</a>"
          />
          <LMarker
            :lat-lng="[model.lat, model.long]"
            :options="{ title: model.name || 'Venue' }"
          >
            <LPopup>
              <MapLocationPopup :title="model.name || 'Venue'" :centered="false" />
            </LPopup>
          </LMarker>
        </LMap>
      </ClientOnly>
    </div>
  </div>
</template>
