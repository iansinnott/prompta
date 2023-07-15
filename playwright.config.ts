import { devices, type PlaywrightTestConfig } from "@playwright/test";

const config: PlaywrightTestConfig = {
  use: {
    baseURL: "http://localhost:5173",
  },
  projects: [
    {
      name: "mobile",
      use: { ...devices["iPhone 13 Mini"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    port: 5173,
    reuseExistingServer: !process.env.CI,
  },
  testDir: "tests",
};

export default config;
