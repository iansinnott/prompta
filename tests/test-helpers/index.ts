import { test as setup, expect, type Page } from "@playwright/test";

/**
 * @NOTE This is the approach recommended for single-user auth. Since this is a
 * local app it should server our purpose.
 */

const authFile = "playwright/.auth/user.json";
const apiKey = process.env.TEST_OPENAI_API_KEY as string;

export const fillOpenAIKey = async (page: Page, { store = true } = {}) => {
  await page.goto("/");
  const welcomeHeading = page.getByRole("heading", { name: "Quick setup" });
  await expect(welcomeHeading).toBeVisible();
  await page.getByTestId("APIKeyInput").fill(apiKey);
  await page.getByTestId("SaveAPIKeyButton").click();
  await expect(welcomeHeading).not.toBeVisible();

  // End of authentication steps.
  if (store) {
    await page.context().storageState({ path: authFile });
  }
};

/**
 * Sends a message to the AI, does not wait for response
 */
export const sendMessage = async (page: Page, { content }: { content: string }) => {
  const chatBox = page.getByPlaceholder("Ask Prompta...");
  const submitButton = page.getByTestId("ChatInputSubmit");
  await chatBox.fill(content);
  await expect(submitButton).toBeVisible();
  await submitButton.click();
};

/**
 *  Sends a message to the AI, waits for response.
 */
export const sendMessageAndWaitForResponse = async (
  page: Page,
  { content }: { content: string }
) => {
  await sendMessage(page, { content });
  const n = await page.locator(".ChatMessage").count();
  await page
    .locator(".ChatMessage")
    .nth(n + 1)
    .waitFor();

  // Wait for the cursor to disappear. The cursor indicates a response is still completing
  await page.locator(".has-cursor").waitFor({ state: "detached" });
  await page.waitForTimeout(50); // A few frames to hopefully allow any cleanup / persistence to happen in the browser
};
