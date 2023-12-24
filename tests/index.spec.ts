import { expect, test } from "@playwright/test";

const apiKey = process.env.TEST_OPENAI_API_KEY as string;

test("has chat input", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("ChatInput")).toBeVisible();
  await page.getByTestId("ChatInput").click();
});

test("can send a message and get a response", async ({ page }) => {
  await page.goto("/");
  const testMessage = `this is a test message. Please respond with the text "pong" to verify we're connected.`;
  const chatBox = page.getByPlaceholder("Ask Prompta...");
  const submitButton = page.getByTestId("ChatInputSubmit");
  await chatBox.fill(testMessage);
  await expect(submitButton).toBeVisible();
  await submitButton.click();
  await expect(page.locator(".ChatMessage")).toHaveCount(2);
});

test("can enable openai", async ({ page }) => {
  test.skip(!apiKey, "TEST_OPENAI_API_KEY not set");

  const btn = page.getByTestId("ModelPickerButton");
  await page.goto("/");
  await btn.click();
  await expect(page.getByTestId("ModelPickerList")).toBeVisible();
  await page.getByRole("option", { name: "OpenAI" }).click();
  await page.getByTestId("APIKeyInput").fill(apiKey);
  await page.keyboard.press("Enter");

  const chatBox = page.getByPlaceholder("Ask Prompta...");
  await expect(chatBox).toBeVisible({ timeout: 10000 });
  await expect(btn).toContainText("gpt-3");
});
