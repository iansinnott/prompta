import { devices, type PlaywrightTestConfig } from "@playwright/test";

/**
 * @see {@link https://playwright.dev/docs/test-configuration}
 */

const config: PlaywrightTestConfig = {
  testDir: "tests",
  fullyParallel: true, // Run all tests in parallel.
  workers: process.env.CI ? 1 : undefined, // Opt out of parallel tests on CI.
  forbidOnly: !!process.env.CI, // Fail the build on CI if you accidentally left test.only in the source code.
  retries: process.env.CI ? 1 : 0, // Retry on CI only.
  use: {
    baseURL: "http://localhost:5173",
  },
  projects: [
    // {
    //   name: "setup",
    //   testMatch: /.*\.setup\.ts/,
    //   use: { ...devices["iPhone 13 Mini"] },
    // },
    {
      name: "mobile",
      use: {
        ...devices["iPhone 13 Mini"],
      },
    },
    // {
    //   name: "desktop",
    //   use: {
    //     ...devices["Desktop Chrome"],
    //   },
    // },
  ],
  webServer: {
    command: "npm run ui:dev",
    port: 5173,
    reuseExistingServer: !process.env.CI,
  },
};

export default config;
