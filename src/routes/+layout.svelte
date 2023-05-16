<script lang="ts">
  import "../app.postcss";
  import { openAiConfig, syncStore, showInitScreen } from "../lib/stores/stores";
  import { onMount } from "svelte";
  import { DatabaseMeta, initDb } from "$lib/db";
  import SettingsModal from "$lib/components/SettingsModal.svelte";
  import { getSystem } from "$lib/gui";
  import classNames from "classnames";
  import { dev } from "$app/environment";

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
      $showInitScreen = true;
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

  let telemetryDisabled = dev;
  onMount(() => {
    telemetryDisabled = localStorage.getItem("telemetryDisabled") === "true";
  });

  const siteMeta = {
    name: "Prompta",
    title: "Prompta - Open-source ChatGPT Client",
    description:
      "Prompta is an open-source UI client for talking to ChatGPT (and GPT-4). Store all your chats locally. Search them easily. Sync across devices.",
  };
</script>

<svelte:window on:click={handleExternalUrls} />

<svelte:head>
  <title>{siteMeta.title}</title>
  <meta name="description" content={siteMeta.description} />
  <meta name="twitter:card" content="summary" />
  <meta property="og:title" content={siteMeta.title} />
  <meta property="og:description" content={siteMeta.description} />

  <link rel="icon" type="image/png" sizes="16x16" href="/icon_16x16.png" />
  <link rel="icon" type="image/png" sizes="32x32" href="/icon_16x16@2x.png" />

  <!-- NOTE: user-scalable=no is unfortunate, but safari sometimes zooms in automatically when focusing an input which breaks the layout -->
  <!-- NOTE: viewport-fit=cover may need to be revisited. the current layout doesn't account for notches at all -->
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0, viewport-fit=cover, user-scalable=no"
  />

  {#if !telemetryDisabled}
    <script>
      // prettier-ignore
      !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.async=!0,p.src=s.api_host+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
      // prettier-ignore
      posthog.init('phc_jZwlYsZzRdvtyjOgVSSt4IkuRGZJU37zovr2oj5clAv',{api_host:'https://app.posthog.com'})
    </script>
  {/if}
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
