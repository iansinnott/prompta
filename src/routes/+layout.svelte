<script lang="ts">
  import "../app.postcss";
  import initWasm from "@vlcn.io/crsqlite-wasm";
  import wasmUrl from "@vlcn.io/crsqlite-wasm/crsqlite.wasm?url";
  import { DB_NAME } from "../lib/constants";
  import { db, openAiConfig, sqlite, thread } from "../lib/stores/stores";
  import { Configuration, OpenAIApi } from "openai";
  import type { ChatCompletionRequestMessage, ChatCompletionRequestMessageRoleEnum } from "openai";
  import { onMount } from "svelte";
  import { initDb } from "$lib/db";

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
    let _timeout = setTimeout(() => {
      throw new Error("Timed out trying to initialize");
    }, 15000);
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
