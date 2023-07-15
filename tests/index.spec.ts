import { expect, test } from "@playwright/test";

const apiKey = process.env.TEST_OPENAI_API_KEY as string;

test("store an API key", async ({ page }) => {
  test.skip(!apiKey, "Skipping test because no API key was provided");
  await page.goto("/");
  const welcomeHeading = page.getByRole("heading", { name: "Quick setup" });
  await expect(welcomeHeading).toBeVisible();
  await page.getByTestId("APIKeyInput").fill(apiKey);
  await page.getByTestId("SaveAPIKeyButton").click();
  await expect(welcomeHeading).not.toBeVisible();
  await expect(page.getByPlaceholder("Ask Prompta...")).toBeVisible();
});
