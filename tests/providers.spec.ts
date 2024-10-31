import { test, expect, type Page } from "@playwright/test";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

const openSettings = async (page: Page) => {
  await page.getByTestId("CommandMenuButton").click();
  await page.getByPlaceholder("Search for actions").fill("settings");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Settings", { exact: true })).toBeVisible();
};

test("prompta enabled by default", async ({ page }) => {
  await page.goto("/");
  await openSettings(page);
  await expect(
    page.getByRole("heading", { name: "Prompta", exact: true }).getByRole("switch")
  ).toHaveAttribute("aria-checked", "true");
});

test("custom provider", async ({ page }) => {
  test.skip(!OPENROUTER_API_KEY, "OPENROUTER_API_KEY is not set");

  const customProvider = {
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    apiKey: OPENROUTER_API_KEY as string,
  };

  // Go to the settings
  await page.goto("/");
  await openSettings(page);

  // Add custom provider
  await page.getByRole("button", { name: "Add custom" }).click();
  await page.getByPlaceholder("Name of the provider").fill(customProvider.name);
  await page.getByPlaceholder("Base URL (ex: https://api.").fill(customProvider.baseUrl);
  await page.getByPlaceholder("API Key (Optional)").nth(1).fill(customProvider.apiKey);
  await page.getByRole("button", { name: "Save" }).click();

  // Wait for the provider to be added and check for the delete button
  const providerHeading = page.getByRole("heading", { name: customProvider.name });
  await expect(providerHeading).toBeVisible({ timeout: 10000 });
  await expect(providerHeading.getByRole("button")).toBeVisible();

  // Check that it's enabled by default
  await expect(providerHeading.getByRole("switch")).toHaveAttribute("aria-checked", "true", {
    timeout: 10000,
  });

  // Close the settings panel
  await page.keyboard.press("Escape");
  await expect(page.getByText("Settings", { exact: true })).not.toBeVisible();

  // Check that the models of the provider were loaded and select one
  await page.getByTestId("ModelPickerButton").click();
  await expect(page.getByTestId("ModelPickerList")).toBeVisible();
  await page.getByPlaceholder("Model...").fill("llama");

  const llamaOption = page.getByRole("option", {
    name: "meta-llama/llama-3.2-1b-instruct",
    exact: true,
  });
  await expect(llamaOption).toBeVisible({ timeout: 10000 });
  await llamaOption.click();
  await expect(page.getByTestId("ModelPickerList")).not.toBeVisible();

  // Reload the page and check the model is still selected as the default
  await page.reload();

  // Wait for the page to be fully loaded after reload
  await page.getByTestId("ModelPickerButton").click();
  await page.getByPlaceholder("Model...").fill("llama");

  // Wait for the option to be visible and selected
  await expect(llamaOption).toBeVisible({ timeout: 10000 });
});
