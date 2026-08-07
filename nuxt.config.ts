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
      icons: [
        "tabler:alert-circle",
        "tabler:alert-triangle",
        "tabler:brand-facebook",
        "tabler:brand-github",
        "tabler:brand-google",
        "tabler:circle-check",
        "tabler:eye",
        "tabler:eye-off",
        "tabler:info-circle",
        "tabler:key",
        "tabler:link-off",
        "tabler:mail",
      ],
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
