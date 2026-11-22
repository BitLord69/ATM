<script setup lang="ts">
const props = withDefaults(defineProps<{
  tournamentDisciplineEnabled: DisciplineEnabledState;
  disableGlobalFields?: boolean;
  mapHint?: string;
  fallbackCenter?: [number, number];
  section?: "all" | "details" | "disciplines" | "location";
}>(), {
  disableGlobalFields: false,
  mapHint: "Click map to set this venue location",
  fallbackCenter: () => [59.67497, 12.85981],
  section: "all",
});
const emit = defineEmits<{
  (event: "mapClick", value: any): void;
}>();

type VenueCourseLayoutDraft = {
  id?: string;
  name: string;
  par: number | string;
  holeCount: number | string | null;
};

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
  courseLayouts?: VenueCourseLayoutDraft[];
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
const venueMapRef = ref<{ recenter: () => void } | null>(null);

function centerMapOnPin() {
  venueMapRef.value?.recenter();
}

function addCourseLayout() {
  const nextLayouts = [...(model.value.courseLayouts ?? []), {
    name: "",
    par: 54,
    holeCount: 18,
  }];
  model.value.courseLayouts = nextLayouts;
}

function removeCourseLayout(index: number) {
  const nextLayouts = [...(model.value.courseLayouts ?? [])];
  nextLayouts.splice(index, 1);
  model.value.courseLayouts = nextLayouts;
}
</script>

<template>
  <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
    <template v-if="section === 'all' || section === 'details'">
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
    </template>

    <template v-if="section === 'all' || section === 'disciplines'">
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

      <!-- Disc Golf Course Layouts -->
      <div
        v-if="model.hasGolf"
        class="md:col-span-2"
      >
        <div class="rounded-box bg-base-100 border border-base-300/60 p-3 md:p-4 space-y-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 class="text-sm font-semibold">
                Disc Golf Course Layouts
              </h3>
              <p class="text-xs opacity-70">
                Add one or more layouts (e.g. Main 18, Pro Blue, Short Red) with their par to prefill round settings.
              </p>
            </div>
            <button
              type="button"
              class="btn btn-xs btn-primary gap-1"
              :disabled="disableGlobalFields"
              @click="addCourseLayout"
            >
              <Icon
                name="tabler:plus"
                size="14"
              />
              Add Layout
            </button>
          </div>

          <div
            v-if="!model.courseLayouts || model.courseLayouts.length === 0"
            class="text-xs opacity-60 italic py-1"
          >
            No layouts added yet. Click "+ Add Layout" to define course layouts and pars for this venue.
          </div>

          <div
            v-else
            class="space-y-2"
          >
            <div
              v-for="(layout, index) in model.courseLayouts"
              :key="layout.id || `layout-${index}`"
              class="grid grid-cols-1 sm:grid-cols-[1fr_5.5rem_5.5rem_auto] gap-2 items-end bg-base-200/60 rounded-lg p-2.5 border border-base-300/50"
            >
              <div class="flex flex-col gap-1">
                <label
                  :for="`venue-layout-name-${index}`"
                  class="text-xs font-medium opacity-80"
                >
                  Layout name
                </label>
                <input
                  :id="`venue-layout-name-${index}`"
                  v-model="layout.name"
                  type="text"
                  placeholder="e.g. Main 18"
                  class="input input-bordered input-sm w-full"
                  :disabled="disableGlobalFields"
                  required
                >
              </div>

              <div class="flex flex-col gap-1">
                <label
                  :for="`venue-layout-par-${index}`"
                  class="text-xs font-medium opacity-80"
                >
                  Par
                </label>
                <input
                  :id="`venue-layout-par-${index}`"
                  v-model.number="layout.par"
                  type="number"
                  min="18"
                  max="150"
                  placeholder="54"
                  class="input input-bordered input-sm w-full"
                  :disabled="disableGlobalFields"
                  required
                >
              </div>

              <div class="flex flex-col gap-1">
                <label
                  :for="`venue-layout-holes-${index}`"
                  class="text-xs font-medium opacity-80"
                >
                  Holes
                </label>
                <input
                  :id="`venue-layout-holes-${index}`"
                  v-model.number="layout.holeCount"
                  type="number"
                  min="1"
                  max="72"
                  placeholder="18"
                  class="input input-bordered input-sm w-full"
                  :disabled="disableGlobalFields"
                >
              </div>

              <button
                type="button"
                class="btn btn-ghost btn-sm btn-square text-error"
                aria-label="Remove layout"
                :disabled="disableGlobalFields"
                @click="removeCourseLayout(index)"
              >
                <Icon
                  name="tabler:x"
                  size="16"
                />
              </button>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template v-if="section === 'all' || section === 'location'">
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
        <div class="flex flex-wrap items-center justify-between gap-2 mb-1.5">
          <p class="text-sm opacity-70">
            {{ mapHint }}
          </p>
          <button
            v-if="model.lat && model.long"
            type="button"
            class="btn btn-xs btn-outline gap-1"
            @click="centerMapOnPin"
          >
            <Icon
              name="tabler:map-pin"
              size="14"
            />
            Center on pin
          </button>
        </div>
        <ClientOnly>
          <div class="w-full rounded-box overflow-hidden border border-base-300">
            <VenueMap
              ref="venueMapRef"
              :lat="model.lat"
              :long="model.long"
              :title="model.name || 'Venue'"
              :description="model.description"
              :facilities="model.facilities"
              :has-golf="model.hasGolf"
              :has-accuracy="model.hasAccuracy"
              :has-distance="model.hasDistance"
              :has-scf="model.hasSCF"
              :has-discathon="model.hasDiscathon"
              :has-ddc="model.hasDDC"
              :has-freestyle="model.hasFreestyle"
              :fallback-center="props.fallbackCenter"
              height="420px"
              :clickable="true"
              :numbered-marker="true"
              :marker-index="0"
              @map-click="emit('mapClick', $event)"
            />
          </div>
        </ClientOnly>
      </div>
    </template>
  </div>
</template>
