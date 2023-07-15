import { expect, test } from "@playwright/test";

const apiKey = process.env.TEST_OPENAI_API_KEY as string;

test("store an API key", async ({ page }) => {
  test.skip(!apiKey, "Skipping test because no API key was provided");
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Quick setup" })).toBeVisible();
  await page.getByTestId("APIKeyInput").fill(apiKey);
  await page.getByTestId("SaveAPIKeyButton").click();
  await expect(page.getByPlaceholder("Ask Prompta...")).toBeVisible();
});
