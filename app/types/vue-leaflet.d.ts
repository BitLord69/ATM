declare module "@vue-leaflet/vue-leaflet" {
  import type { DefineComponent, PropType } from "vue";

  type LatLngTuple = [number, number];

  export const LMap: DefineComponent<{
    zoom?: number;
    center?: LatLngTuple;
  }>;

  export const LTileLayer: DefineComponent<{
    url: string;
    attribution?: string;
  }>;

  export const LMarker: DefineComponent<{
    latLng: {
      type: PropType<LatLngTuple>;
      required: true;
    };
  }>;

  export const LPopup: DefineComponent<Record<string, never>>;
}
