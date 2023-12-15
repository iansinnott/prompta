<script lang="ts">
  import { syncStore, openAiConfig } from "$lib/stores/stores";
  import classNames from "classnames";
  import { slide } from "svelte/transition";
  import CopyButton from "./CopyButton.svelte";
  import { onMount } from "svelte";
  import { error } from "@sveltejs/kit";

  let syncString = "";
  let showAdvanced = false;

  const serverConfig = syncStore.serverConfig;

  onMount(() => {
    serverConfig.init();
  });

  $: console.log($serverConfig);
  $: isConnectionActive = $syncStore.connection !== "";
</script>

<div
  class="fixed top-16 left-0 sm:w-[420px] sm:left-6 bg-zinc-600 rounded-lg p-3 shadow-lg z-10 space-y-4 overflow-auto max-h-[80vh]"
>
  <div>
    <p>
      <span class="text-sm">Announce: </span>Sync
      <span class="font-mono p-1 bg-black text-green-500 rounded-full text-xs font-bold"
        >v2:beta</span
      >
    </p>
    <p>
      <small class="leading-none"
        >This is a rewrite of the initial syncing mechanism. It may have bugs. Please report sync
        <a
          class="text-blue-200 underline"
          href="https://github.com/iansinnott/prompta/issues"
          target="_blank">issues</a
        > if you encounter them.</small
      >
    </p>
  </div>
  <button
    on:click={() => {
      if ($syncStore.connection) {
        syncStore.disconnect();
      } else {
        console.log("Connecting to", $syncStore.connection || $openAiConfig.siteId);
        syncStore.connectTo($syncStore.connection || $openAiConfig.siteId);
      }
    }}
    class="p-4 rounded-lg border border-zinc-300 w-full"
  >
    {$syncStore.connection ? "Disconnect" : "Enable Sync"}
  </button>

  <hr class="my-4 border-white/20" />

  <h2 class="text-sm uppercase font-semibold">
    Connection: <span
      class={classNames({
        "text-zinc-300": !$syncStore.error && !isConnectionActive,
        "text-teal-300": !$syncStore.error && isConnectionActive,
        "text-red-400 bg-black px-2 py-1": $syncStore.error,
      })}
      >{$syncStore.error
        ? $syncStore.error.message
        : isConnectionActive
        ? "Active"
        : "Inactive"}</span
    >
    {#if $syncStore.error?.detail}
      <small class="block text-xs mt-2 bg-zinc-800 px-2 py-1">{$syncStore.error.detail}</small>
    {/if}
  </h2>

  <hr class="my-4 border-white/20" />

  {#if !isConnectionActive}
    <div class="flex flex-col space-y-4" transition:slide|local={{ duration: 150 }}>
      <small>
        Enabling sync allows you to access your chats from multiple devices, and is totally
        optional. Your messages will be synced through a sync server. You can use the default
        (sync.prompta.dev) or run your own.
      </small>
    </div>
  {:else}
    <div class="flex flex-col space-y-4" transition:slide|local={{ duration: 150 }}>
      <p>Copy the sync code below to share with your other devices.</p>
      <div
        class="font-mono text-sm p-4 bg-zinc-700 rounded-lg flex justify-between items-center border-2 border-teal-500"
      >
        <span>
          {$syncStore.connection || "Not connected"}
        </span>
        <CopyButton text={$syncStore.connection} />
      </div>
    </div>

    <hr class="my-4 border-white/20" />

    <div class="flex flex-col space-y-4" transition:slide|local={{ duration: 150 }}>
      <h2 class="mb-4 text-sm uppercase font-semibold">Connect to new sync chain</h2>
      <p>Enter a sync code you copied from another device below to start syncing.</p>

      <form
        class=""
        on:submit={(e) => {
          e.preventDefault();
          if (!syncString) {
            console.warn("No sync string");
            return;
          }
          syncStore.connectTo(syncString);
        }}
      >
        <div
          class="flex justify-between items-center font-mono text-sm p-4 bg-zinc-700 rounded-lg space-x-2"
        >
          <div class="flex-1">
            <input
              bind:value={syncString}
              placeholder="Sync code..."
              class="bg-transparent w-full outline-none appearance-none truncate py-2"
            />
          </div>
          <button class="px-4 py-2 border-2 border-white/20 rounded-lg"> Connect </button>
        </div>
      </form>
    </div>
  {/if}

  <button
    class="px-4 py-2 border-2 border-white/20 rounded-lg"
    on:click={() => {
      showAdvanced = !showAdvanced;
    }}>{showAdvanced ? "Hide" : "Show"} Advanced</button
  >

  {#if showAdvanced}
    <form transition:slide|local={{ duration: 150 }} on:submit|preventDefault>
      <fieldset>
        <label for="endpoint" class="text-lg">Endpoint</label>
        <p class="mb-2">You can customize this to use your own sync server.</p>
        <input
          id="endpoint"
          class="bg-transparent w-full outline-none appearance-none truncate px-4 rounded-lg py-2 bg-zinc-700"
          type="text"
          bind:value={$serverConfig.endpoint}
        />
      </fieldset>
    </form>
  {/if}
</div>
