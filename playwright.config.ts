import { existsSync } from "node:fs";

import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";

if (existsSync(".env.e2e")) {
  loadEnv({ path: ".env.e2e" });
}

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: 0,
  timeout: 45_000,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
