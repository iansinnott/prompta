import { devices, type PlaywrightTestConfig } from "@playwright/test";

const config: PlaywrightTestConfig = {
  use: {
    headless: false,
    ...devices["iPhone 13 Mini"],
  },
  webServer: {
    command: "npm run preview",
    port: 4173,
  },
  testDir: "tests",
};

export default config;
