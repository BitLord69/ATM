<script setup lang="ts">
import { LMap, LTileLayer } from "@vue-leaflet/vue-leaflet";
import { nextTick, onBeforeUnmount, onErrorCaptured, onMounted, ref, toRefs, watch } from "vue";

import { MAP_TILE_ATTRIBUTION, MAP_TILE_URL } from "~/composables/use-leaflet-map";

import "leaflet/dist/leaflet.css";

const props = withDefaults(defineProps<{
  center: [number, number];
  zoom: number;
  height?: string;
  bounds?: [[number, number], [number, number]];
  boundsOptions?: Record<string, any>;
  mapKey?: string | number;
  withCard?: boolean;
}>(), {
  height: "400px",
  bounds: undefined,
  boundsOptions: undefined,
  mapKey: undefined,
  withCard: true,
});

const emit = defineEmits<{
  (event: "mapClick", value: any): void;
}>();

const { center, zoom, height, bounds, boundsOptions, mapKey, withCard } = toRefs(props);

const leafletMap = ref<any | null>(null);
const isMounted = ref(false);
let isUnmounted = false;

onMounted(() => {
  isMounted.value = true;
});

// @vue-leaflet/vue-leaflet initializes L.map() asynchronously after import("leaflet");
// if the component unmounts or HMR reloads mid-init, Leaflet throws "Map container not found."
onErrorCaptured((err) => {
  if (err instanceof Error && err.message.includes("Map container not found")) {
    return false;
  }
  return true;
});

function onMapClick(event: any) {
  emit("mapClick", event);
}

function fitToBounds() {
  if (isUnmounted || !leafletMap.value || !bounds.value) {
    return;
  }

  const container = typeof leafletMap.value.getContainer === "function"
    ? leafletMap.value.getContainer()
    : null;
  if (!container || !container.isConnected) {
    return;
  }

  leafletMap.value.invalidateSize();
  leafletMap.value.fitBounds(bounds.value, boundsOptions.value || undefined);
}

function onMapReady(map: any) {
  if (isUnmounted) {
    return;
  }
  leafletMap.value = map;
  void nextTick(fitToBounds);
}

function recenter(targetCenter?: [number, number], targetZoom?: number) {
  if (isUnmounted || !leafletMap.value) {
    return;
  }
  const nextCenter = targetCenter ?? center.value;
  const nextZoom = targetZoom ?? zoom.value;
  if (typeof leafletMap.value.setView === "function") {
    leafletMap.value.setView(nextCenter, nextZoom, { animate: true });
  }
}

defineExpose({
  recenter,
});

onBeforeUnmount(() => {
  isUnmounted = true;
  isMounted.value = false;
  leafletMap.value = null;
});

watch(
  [bounds, boundsOptions],
  () => {
    void nextTick(fitToBounds);
  },
  { deep: true, immediate: true },
);
</script>

<template>
  <div v-if="withCard" class="card bg-base-200">
    <div class="card-body p-0">
      <LMap
        v-if="isMounted"
        :key="mapKey"
        :zoom="zoom"
        :center="center"
        :bounds="bounds"
        :bounds-options="boundsOptions"
        :style="{ height, zIndex: 0 }"
        @ready="onMapReady"
        @click="onMapClick"
      >
        <LTileLayer
          :url="MAP_TILE_URL"
          :attribution="MAP_TILE_ATTRIBUTION"
        />
        <slot />
      </LMap>
    </div>
  </div>

  <LMap
    v-else-if="isMounted"
    :key="mapKey"
    :zoom="zoom"
    :center="center"
    :bounds="bounds"
    :bounds-options="boundsOptions"
    :style="{ height, zIndex: 0 }"
    @ready="onMapReady"
    @click="onMapClick"
  >
    <LTileLayer
      :url="MAP_TILE_URL"
      :attribution="MAP_TILE_ATTRIBUTION"
    />
    <slot />
  </LMap>
</template>
