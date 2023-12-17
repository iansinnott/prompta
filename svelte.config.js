import preprocess from "svelte-preprocess";
import staticAdapter from "@sveltejs/adapter-static";
import autoAdapter from "@sveltejs/adapter-auto";

import { vitePreprocess } from "@sveltejs/kit/vite";

const SVELTE_ADAPTER = process.env.SVELTE_ADAPTER;

const adapter =
  SVELTE_ADAPTER === "static"
    ? staticAdapter({ strict: false }) // NOTE strict: false is required for sveltekit to ignore the dynamic node.js routes which are present. The static build is only for Tauri
    : autoAdapter();

/** @type {import('@sveltejs/kit').Config} */
const config = {
  // Consult https://kit.svelte.dev/docs/integrations#preprocessors
  // for more information about preprocessors
  preprocess: [
    vitePreprocess(),
    preprocess({
      postcss: true,
    }),
  ],

  kit: {
    // adapter-auto only supports some environments, see https://kit.svelte.dev/docs/adapter-auto for a list.
    // If your environment is not supported or you settled on a specific environment, switch out the adapter.
    // See https://kit.svelte.dev/docs/adapters for more information about adapters.
    adapter,
    serviceWorker: {
      register: false,
    },
  },
};

export default config;
