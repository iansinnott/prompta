import { test as setup, expect } from "@playwright/test";

/**
 * @NOTE This is the approach recommended for single-user auth. Since this is a
 * local app it should server our purpose.
 *
 * Update: This doesn't currently do much, so it might be best removed.
 */

setup("store an API key", async ({ page }) => {
  await page.goto("/");
});
