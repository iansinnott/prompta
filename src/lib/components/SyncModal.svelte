<script lang="ts">
  import { syncStore, openAiConfig } from "$lib/stores/stores";
  import classNames from "classnames";
  import { slide } from "svelte/transition";
  import CopyButton from "./CopyButton.svelte";
  import { onMount } from "svelte";
  import { Eye, EyeOff } from "lucide-svelte";

  let syncString = "";
  let showAdvanced = false;
  let showConnectionString = false;

  const serverConfig = syncStore.serverConfig;

  onMount(() => {
    serverConfig.init();
  });

  $: isConnectionActive = $syncStore.connection !== "";
  $: isConnecting = $syncStore.status === "connecting";
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
      // In the case of 'connecting', we want to cancel the connection. This
      // avoids the UI becoming unusable when there is no internet connection.
      if ($syncStore.connection || isConnecting) {
        syncStore.disconnect();
      } else {
        const lastSyncChain = localStorage.getItem("lastSyncChain") || $openAiConfig.siteId;
        console.log("Connecting to", lastSyncChain);
        syncStore.connectTo(lastSyncChain, { autoSync: true });
      }
    }}
    class={classNames("p-4 rounded-lg border border-zinc-300 w-full", {})}
  >
    {#if $syncStore.status === "connecting"}
      Cancel Connection
    {:else if isConnectionActive}
      Disconnect
    {:else}
      Enable Sync
    {/if}
  </button>

  <hr class="my-4 border-white/20" />

  <h2 class="text-sm uppercase font-semibold">
    Connection:
    <span
      class={classNames({
        "text-zinc-300": !$syncStore.error && !isConnectionActive && !isConnecting,
        "text-teal-300": !$syncStore.error && isConnectionActive && !isConnecting,
        "text-red-400 bg-black px-2 py-1": Boolean($syncStore.error) && !isConnecting,
        "text-transparent bg-gradient-roll bg-gradient-to-br from-yellow-300 to-orange-400 bg-clip-text":
          isConnecting,
      })}
    >
      {#if $syncStore.error && isConnectionActive}
        {$syncStore.error.message}
      {:else if isConnecting}
        Connecting...
      {:else if isConnectionActive}
        Active
      {:else}
        Inactive
      {/if}
    </span>

    {#if $syncStore.error?.detail}
      <small class="block text-xs mt-2 bg-zinc-800 px-2 py-1">{$syncStore.error.detail}</small>
    {/if}
  </h2>

  <hr class="my-4 border-white/20" />

  {#if !isConnectionActive}
    <div class="flex flex-col space-y-4" transition:slide={{ duration: 150 }}>
      <small>
        Enabling sync allows you to access your chats from multiple devices, and is totally
        optional. Your messages will be synced through a sync server. You can use the default
        (sync.prompta.dev) or run your own.
      </small>
    </div>
  {:else}
    <div class="flex flex-col space-y-4" transition:slide={{ duration: 150 }}>
      <p>Copy the sync code below to share with your other devices.</p>
      <div
        class="font-mono text-sm p-4 bg-zinc-700 rounded-lg flex justify-between items-center border-2 border-teal-500"
      >
        <span>
          {#if $syncStore.connection}
            {$syncStore.connection.slice(0, 4) +
              $syncStore.connection
                .slice(8)
                .split("")
                .map(() => "•")
                .join("")}
          {:else}
            Not connected
          {/if}
        </span>
        <button class="" on:click={() => (showConnectionString = !showConnectionString)}>
          {#if showConnectionString}
            <EyeOff class="text-white/40 hover:text-white" />
          {:else}
            <Eye class="text-white/40 hover:text-white" />
          {/if}
        </button>
        <CopyButton text={$syncStore.connection} />
      </div>
    </div>
    {#if showConnectionString}
      <div class="flex flex-col space-y-4" transition:slide={{ duration: 150 }}>
        <small class="block">
          <strong>Note:</strong> This is a secret key that allows anyone to connect to your sync chain.
          Only share it deliberately.
        </small>
        <div
          class="font-mono text-sm p-1 px-2 bg-zinc-700 rounded-lg flex justify-between items-center"
        >
          <span>{$syncStore.connection}</span>
        </div>
      </div>
    {/if}

    <hr class="my-4 border-white/20" />

    <div class="flex flex-col space-y-4" transition:slide={{ duration: 150 }}>
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
          syncStore.connectTo(syncString, { autoSync: true });
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
    <form transition:slide={{ duration: 150 }} on:submit|preventDefault>
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

<style>
  @keyframes gradient-roll {
    0% {
      background-position: 0% 50%;
    }
    100% {
      background-position: -400% 50%;
    }
  }

  .bg-gradient-roll {
    background-size: 200% 200%;
    animation: gradient-roll 3s linear infinite;
  }
</style>
