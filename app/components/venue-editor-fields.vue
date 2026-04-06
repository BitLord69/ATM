<script setup lang="ts">
import { disciplineByKey } from "~/composables/use-discipline-catalog";

withDefaults(defineProps<{
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
          :label="disciplineByKey.hasGolf.label"
          :icon="disciplineByKey.hasGolf.icon"
          :desktop-inline="true"
          :disabled="!tournamentDisciplineEnabled.hasGolf"
          :tooltip="!tournamentDisciplineEnabled.hasGolf ? `Enable ${disciplineByKey.hasGolf.label} at tournament level first.` : ''"
        />
        <ToggleField
          v-model="model.hasAccuracy"
          :label="disciplineByKey.hasAccuracy.label"
          :icon="disciplineByKey.hasAccuracy.icon"
          :desktop-inline="true"
          :disabled="!tournamentDisciplineEnabled.hasAccuracy"
          :tooltip="!tournamentDisciplineEnabled.hasAccuracy ? `Enable ${disciplineByKey.hasAccuracy.label} at tournament level first.` : ''"
        />
        <ToggleField
          v-model="model.hasDistance"
          :label="disciplineByKey.hasDistance.label"
          :icon="disciplineByKey.hasDistance.icon"
          :desktop-inline="true"
          :disabled="!tournamentDisciplineEnabled.hasDistance"
          :tooltip="!tournamentDisciplineEnabled.hasDistance ? `Enable ${disciplineByKey.hasDistance.label} at tournament level first.` : ''"
        />
        <ToggleField
          v-model="model.hasSCF"
          :label="disciplineByKey.hasSCF.label"
          :icon="disciplineByKey.hasSCF.icon"
          :desktop-inline="true"
          :disabled="!tournamentDisciplineEnabled.hasSCF"
          :tooltip="!tournamentDisciplineEnabled.hasSCF ? `Enable ${disciplineByKey.hasSCF.label} at tournament level first.` : ''"
        />
        <ToggleField
          v-model="model.hasDiscathon"
          :label="disciplineByKey.hasDiscathon.label"
          :icon="disciplineByKey.hasDiscathon.icon"
          :desktop-inline="true"
          :disabled="!tournamentDisciplineEnabled.hasDiscathon"
          :tooltip="!tournamentDisciplineEnabled.hasDiscathon ? `Enable ${disciplineByKey.hasDiscathon.label} at tournament level first.` : ''"
        />
        <ToggleField
          v-model="model.hasDDC"
          :label="disciplineByKey.hasDDC.label"
          :icon="disciplineByKey.hasDDC.icon"
          :desktop-inline="true"
          :disabled="!tournamentDisciplineEnabled.hasDDC"
          :tooltip="!tournamentDisciplineEnabled.hasDDC ? `Enable ${disciplineByKey.hasDDC.label} at tournament level first.` : ''"
        />
        <ToggleField
          v-model="model.hasFreestyle"
          :label="disciplineByKey.hasFreestyle.label"
          :icon="disciplineByKey.hasFreestyle.icon"
          :desktop-inline="true"
          :disabled="!tournamentDisciplineEnabled.hasFreestyle"
          :tooltip="!tournamentDisciplineEnabled.hasFreestyle ? `Enable ${disciplineByKey.hasFreestyle.label} at tournament level first.` : ''"
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
        <VenueMap
          :lat="model.lat"
          :long="model.long"
          :title="model.name || 'Venue'"
          :has-golf="model.hasGolf"
          :has-accuracy="model.hasAccuracy"
          :has-distance="model.hasDistance"
          :has-scf="model.hasSCF"
          :has-discathon="model.hasDiscathon"
          :has-ddc="model.hasDDC"
          :has-freestyle="model.hasFreestyle"
          :fallback-center="fallbackCenter"
          height="220px"
          :clickable="true"
          @map-click="emit('mapClick', $event)"
        />
      </ClientOnly>
    </div>
  </div>
</template>
