<script setup lang="ts">
import { LMap, LMarker, LPopup, LTileLayer } from "@vue-leaflet/vue-leaflet";
import "leaflet/dist/leaflet.css";

defineProps<{
  lat: number;
  long: number;
  name: string;
  city?: string | null;
  country?: string | null;
  venues?: Array<{
    id: number;
    lat: number;
    long: number;
    name: string;
    description: string | null;
    facilities: string | null;
  }>;
}>();

// Fix Leaflet default icon paths
if (typeof window !== "undefined") {
  const L = await import("leaflet");
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
}
</script>

<template>
  <div class="card bg-base-200">
    <div class="card-body p-0">
      <LMap
        :zoom="12"
        :center="[lat, long]"
        style="height: 400px; z-index: 0;"
      >
        <LTileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors"
        />
        <!-- Tournament HQ Marker -->
        <LMarker :lat-lng="[lat, long]">
          <LPopup>
            <div class="text-center">
              <p class="font-semibold">
                📍 {{ name }} HQ
              </p>
              <p class="text-sm">
                {{ [city, country].filter(Boolean).join(", ") }}
              </p>
            </div>
          </LPopup>
        </LMarker>
        <!-- Discipline Venue Markers -->
        <LMarker
          v-for="venue in venues"
          :key="venue.id"
          :lat-lng="[venue.lat, venue.long]"
        >
          <LPopup>
            <div class="text-center">
              <p class="font-semibold">
                🎯 {{ venue.name }}
              </p>
              <p
                v-if="venue.description"
                class="text-sm"
              >
                {{ venue.description }}
              </p>
              <p
                v-if="venue.facilities"
                class="text-xs opacity-70 mt-1"
              >
                {{ venue.facilities }}
              </p>
            </div>
          </LPopup>
        </LMarker>
      </LMap>
    </div>
  </div>
</template>
