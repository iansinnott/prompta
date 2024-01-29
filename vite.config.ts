import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vitest/config";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

export default defineConfig({
  plugins: [sveltekit(), wasm(), topLevelAwait()],
  build: {
    // Disable asset inlining. This is currently required for our migration
    // system (yikes!). Client-side migrations are sort of odd, because we
    // naturally don't have a filesystem. but sqlite wasm allows us to operate
    // mostly like a server. Asset inlining bit me when trying to import
    // mygration files via URL, and depending on the URL actually being a URL.
    assetsInlineLimit: 0,
  },
  define: {
    "process.env.CI": JSON.stringify(process.env.CI),
  },
  test: {
    include: ["src/**/*.{test,spec}.{js,ts}"],
  },
});
