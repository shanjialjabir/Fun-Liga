import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:3100",
    headless: true,
    reducedMotion: "reduce",
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
      args: ["--no-sandbox"],
    },
    trace: "retain-on-failure",
  },
  webServer: {
    command: `DEMO_MODE=true DEMO_DATA_DIR=/tmp/fun-soccer-e2e-${process.pid} pnpm start --port 3100`,
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    timeout: 120000,
  },
});
