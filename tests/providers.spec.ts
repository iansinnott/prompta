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

  // Check if the provider is added by checking that there is now a delete button
  await expect(
    page.getByRole("heading", { name: customProvider.name }).getByRole("button")
  ).toBeVisible();

  // Check that it's enabled by default
  await expect(
    page.getByRole("heading", { name: customProvider.name, exact: true }).getByRole("switch")
  ).toHaveAttribute("aria-checked", "true", { timeout: 6_000 });

  // Close the settinsg panel
  await page.keyboard.press("Escape");
  await expect(page.getByText("Settings", { exact: true })).not.toBeVisible();

  // Check that the models of the provider were loaded and select one
  await page.getByTestId("ModelPickerButton").click();
  await expect(page.getByTestId("ModelPickerList")).toBeVisible();
  await page.getByPlaceholder("Model...").fill("zeph");
  await page
    .getByRole("option", { name: "huggingfaceh4/zephyr-7b-beta" })
    .click({ timeout: 6_000 });
  await expect(page.getByTestId("ModelPickerList")).not.toBeVisible();

  // Reload the page and check the model is still selected as the default
  await page.reload();
  await page.getByTestId("ModelPickerButton").click();
  await page.getByPlaceholder("Model...").fill("zeph");
  await expect(page.getByRole("option", { name: "huggingfaceh4/zephyr-7b-beta" })).toHaveAttribute(
    "aria-selected",
    "true"
  );
});
