import { env } from "node:process";
import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
  runtimeConfig: {
    public: {
      betterAuthUrl: env.BETTER_AUTH_URL,
    },
  },
  vite: {
    resolve: {
      tsconfigPaths: true,
    },
    plugins: [
      tailwindcss(),
    ],
  },
  compatibilityDate: "2025-07-15",
  devtools: { enabled: false },
  colorMode: {
    dataValue: "theme",
  },
  icon: {
    provider: "none",
    mode: "svg",
    clientBundle: {
      scan: true,
    },
  },
  modules: [
    "@nuxt/eslint",
    "@nuxt/icon",
    "@nuxtjs/color-mode",
    "@pinia/nuxt",
  ],
  css: [
    "~/assets/css/main.css",
    "leaflet/dist/leaflet.css",
  ],
  eslint: {
    config: {
      standalone: false,
    },
  },
});
