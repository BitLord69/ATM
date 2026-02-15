import tailwindcss from "@tailwindcss/vite";
import { env } from "node:process";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineNuxtConfig({
  runtimeConfig: {
    public: {
      betterAuthUrl: env.BETTER_AUTH_URL,
    },
  },
  vite: {
    plugins: [
      tsconfigPaths(),
      tailwindcss(),
    ],
  },
  compatibilityDate: "2025-07-15",
  devtools: { enabled: false },
  colorMode: {
    dataValue: "theme",
  },
  modules: [
    "@nuxt/eslint",
    "@nuxt/icon",
    "@nuxtjs/color-mode",
    "@pinia/nuxt",
  ],
  css: ["~/assets/css/main.css"],
  eslint: {
    config: {
      standalone: false,
    },
  },
});
