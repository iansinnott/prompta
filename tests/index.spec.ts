import { expect, test } from "@playwright/test";

const apiKey = process.env.TEST_OPENAI_API_KEY as string;

test("has chat input", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("ChatInput")).toBeVisible();
  await page.getByTestId("ChatInput").click();
});

// Gah, the issue with this test is that the models have not been fetched yet.
// For speed of startup I should not require model fetching all the time. I
// should cache the models after the first fetch and only invalidate iether
// manually or on provider update.
test("can send a message and get a response", async ({ page }) => {
  await page.goto("/");
  const testMessage = `this is a test message to test the app's integration with openai. Please respond with the text "pong" to verify we're connected.`;
  const chatBox = page.getByTestId("ChatInput");
  const submitButton = page.getByTestId("ChatInputSubmit");
  await chatBox.fill(testMessage);
  await expect(submitButton).toBeVisible();
  await submitButton.click();
  await expect(page.locator(".ChatMessage")).toHaveCount(2);
});
