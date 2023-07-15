import { test as setup, expect } from "@playwright/test";

/**
 * @NOTE This is the approach recommended for single-user auth. Since this is a
 * local app it should server our purpose.
 */

const authFile = "playwright/.auth/user.json";
const apiKey = process.env.TEST_OPENAI_API_KEY as string;

setup("store an API key", async ({ page }) => {
  setup.skip(!apiKey, "Skipping test because no API key was provided");
  await page.goto("/");
  const welcomeHeading = page.getByRole("heading", { name: "Quick setup" });
  await expect(welcomeHeading).toBeVisible();
  await page.getByTestId("APIKeyInput").fill(apiKey);
  await page.getByTestId("SaveAPIKeyButton").click();
  await expect(welcomeHeading).not.toBeVisible();

  // End of authentication steps.
  await page.context().storageState({ path: authFile });
});
