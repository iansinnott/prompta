import preprocess from "svelte-preprocess";
import staticAdapter from "@sveltejs/adapter-static";

import { vitePreprocess } from "@sveltejs/kit/vite";

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
    adapter: staticAdapter(),
    serviceWorker: {
      register: false,
    },
  },
};

export default config;
