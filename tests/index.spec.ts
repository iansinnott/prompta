import { expect, test } from "@playwright/test";

const apiKey = process.env.TEST_OPENAI_API_KEY as string;

test("has chat input", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("ChatInput")).toBeVisible();
  await page.getByTestId("ChatInput").click();
});

test("can send a message and get a response", async ({ page }) => {
  await page.goto("/");
  const testMessage = `this is a test message to test the app's integration with openai. Please respond with the text "pong" to verify we're connected.`;
  const chatBox = page.getByTestId("ChatInput");
  await chatBox.fill(testMessage);
  await chatBox.press("Enter");
  await expect(page.locator(".ChatMessage")).toHaveCount(2);
});
