<script lang="ts">
  import "../app.postcss";
  import { openAiConfig, syncStore, showSettings } from "../lib/stores/stores";
  import { onMount } from "svelte";
  import { DatabaseMeta, initDb } from "$lib/db";
  import SettingsModal from "$lib/components/SettingsModal.svelte";
  import { getSystem } from "$lib/gui";
  import classNames from "classnames";

  const sys = getSystem();

  let appReady = false;
  onMount(async () => {
    // throw up after a time if the app is hanging
    let _timeout = setTimeout(() => {
      throw new Error("Timed out trying to initialize");
    }, 15000);

    // @note The whole app assumes the db exists and is ready. Do not render before that
    try {
      await initDb();
    } catch (err: any) {
      await sys.alert(
        `There was an error initializing the database. Please try again. If the problem persists, please report it on GitHub.` +
          err.message
      );
      throw err;
    }

    clearTimeout(_timeout);

    if (!$openAiConfig.apiKey) {
      $showSettings = true;
      console.warn(`No API key found. Please enter one in the settings.`);
    }

    appReady = true;

    const siteId = await DatabaseMeta.getSiteId();
    console.debug(`App initialized. siteId=${siteId}`);

    const lastSyncChain = $openAiConfig.lastSyncChain;
    if (lastSyncChain) {
      console.debug(`Connecting to sync chain: ${lastSyncChain}`);

      // Not sure why, but this doesn't work if we do it immediately.
      setTimeout(() => {
        syncStore.connectTo(lastSyncChain);
      }, 1000);
    }
  });

  function isExternalUrl(href: any) {
    if (typeof href !== "string") return false;

    try {
      const url = new URL(href);
      return url.origin !== location.origin;
    } catch (err) {
      console.debug("Could not parse url", err);
      return false;
    }
  }

  function handleExternalUrls(e: MouseEvent) {
    // @ts-ignore
    const href = e.target.href;
    if (isExternalUrl(href)) {
      e.preventDefault();
      sys.openExternal(href);
    }
  }
</script>

<svelte:window on:click={handleExternalUrls} />

<svelte:head>
  <title>Prompta Chat - Chat with ChatGPT and GPT-4. Sync your chats across devices.</title>
  <link rel="icon" type="image/png" sizes="16x16" href="/icon_16x16.png" />
  <link rel="icon" type="image/png" sizes="32x32" href="/icon_16x16@2x.png" />

  <!-- NOTE: user-scalable=no is unfortunate, but safari sometimes zooms in automatically when focusing an input which breaks the layout -->
  <!-- NOTE: viewport-fit=cover may need to be revisited. the current layout doesn't account for notches at all -->
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0, viewport-fit=cover, user-scalable=no"
  />
</svelte:head>

<div
  class={classNames("overflow-hidden text-white bg-[#1B1B1B] border border-zinc-700", {
    "rounded-lg": sys.isTauri,
  })}
>
  {#if appReady}
    <slot />
    <SettingsModal />
  {:else}
    <!-- adding both heights for fallback. not every browser likes svh -->
    <div class="flex items-center justify-center h-screen" style="height: 100svh;">
      <div class="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-zinc-700" />
    </div>
  {/if}
</div>
