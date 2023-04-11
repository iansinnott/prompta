<script lang="ts">
  import "../app.postcss";
  import { openAiConfig, showSettings } from "../lib/stores/stores";
  import { Configuration, OpenAIApi } from "openai";
  import { onMount } from "svelte";
  import { Preferences, Thread, initDb } from "$lib/db";
  import SettingsModal from "$lib/components/SettingsModal.svelte";
  import { initOpenAi } from "$lib/llm";
  import { dev } from "$app/environment";

  let appReady = false;
  onMount(async () => {
    // throw up after a time if the app is hanging
    let _timeout = setTimeout(() => {
      throw new Error("Timed out trying to initialize");
    }, 15000);

    // @note The whole app assumes the db exists and is ready. Do not render before that
    await initDb();

    const apiKey = $openAiConfig.apiKey as string | undefined;

    clearTimeout(_timeout);
    appReady = true;

    if (!$openAiConfig.apiKey) {
      $showSettings = true;
      console.warn(`No API key found. Please enter one in the settings.`);
      return;
    }

    const openAi = initOpenAi({ apiKey });

    if (dev) {
      (window as any).openAi = openAi;
    }

    console.debug(`App initialized.`);
  });
</script>

<div class="min-h-screen text-white rounded-lg bg-[#1B1B1B] border border-zinc-700">
  {#if appReady}
    <slot />
    <SettingsModal />
  {/if}
</div>
