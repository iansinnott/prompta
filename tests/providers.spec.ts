import { test, expect, type Page } from "@playwright/test";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

const openSettings = async (page: Page) => {
  await page.locator("text=Command").click();
  await page.getByPlaceholder("Search for actions").fill("settings");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Settings", { exact: true })).toBeVisible();
};

test("custom provider", async ({ page }) => {
  test.skip(!OPENROUTER_API_KEY, "OPENROUTER_API_KEY is not set");

  await page.goto("/");
  await openSettings(page);
  await expect(
    page.getByRole("heading", { name: "Prompta", exact: true }).getByRole("switch")
  ).toHaveAttribute("aria-checked", "true");

  const customProvider = {
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    apiKey: OPENROUTER_API_KEY as string,
  };

  // Add custom provider
  await page.getByRole("button", { name: "Add custom" }).click();
  await page.getByPlaceholder("Name of the provider").fill(customProvider.name);
  await page.getByPlaceholder("Base URL (ex: https://api.").fill(customProvider.baseUrl);
  await page.getByPlaceholder("API Key (Optional)").nth(1).fill(customProvider.apiKey);
  await page.getByRole("button", { name: "Save" }).click();

  // Check if the provider is added by checking that there is now a delete button
  await expect(
    page.getByRole("heading", { name: customProvider.name }).getByRole("button")
  ).toBeVisible();

  // Close the settinsg panel
  await page.keyboard.press("Escape");
  await expect(page.getByText("Settings", { exact: true })).not.toBeVisible();

  // Check that the models of the provider were loaded
  await page.getByTestId("ModelPickerButton").click();
  await expect(page.getByTestId("ModelPickerList")).toBeVisible();
  await page.getByPlaceholder("Model...").fill("zephyr");
  await page
    .getByRole("option", { name: "huggingfaceh4/zephyr-7b-beta" })
    .click({ timeout: 6_000 });
  await expect(page.getByTestId("ModelPickerList")).not.toBeVisible();

  // Select one of the models

  // Reload the page

  // Check the model is still selected as the default

  await page.pause();
});
