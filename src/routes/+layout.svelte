<script lang="ts">
  import "../app.postcss";
  import { openAiConfig, currentThread } from "../lib/stores/stores";
  import { Configuration, OpenAIApi } from "openai";
  import { onMount } from "svelte";
  import { Preferences, Thread, initDb } from "$lib/db";

  let openai: OpenAIApi;
  let configuration: Configuration;

  let appReady = false;

  const initOpenAi = () => {
    configuration = new Configuration({
      apiKey: $openAiConfig.apiKey,
    });
    openai = new OpenAIApi(configuration);
  };

  onMount(async () => {
    // throw up after a time if the app is hanging
    let _timeout = setTimeout(() => {
      throw new Error("Timed out trying to initialize");
    }, 15000);

    // @note The whole app assumes the db exists and is ready. Do not render before that
    await initDb();

    clearTimeout(_timeout);
    appReady = true;
    console.debug(`App initialized.`);
  });
</script>

<div class="min-h-screen text-white rounded-lg bg-[#1B1B1B] border border-zinc-700">
  {#if appReady}
    <slot />
  {/if}
</div>
