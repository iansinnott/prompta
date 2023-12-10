<script lang="ts">
  import { syncStore, openAiConfig } from "$lib/stores/stores";
  import classNames from "classnames";
  import { slide } from "svelte/transition";
  import CopyButton from "./CopyButton.svelte";

  let syncString = "";

  $: isConnectionActive = $syncStore.connection !== "";
</script>

<div
  class="fixed top-16 left-0 sm:w-[420px] sm:left-6 bg-zinc-600 rounded-lg p-3 shadow-lg z-10 space-y-4 overflow-auto max-h-[80vh]"
>
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
        "text-zinc-300": !isConnectionActive,
        "text-teal-300": isConnectionActive,
      })}>{isConnectionActive ? "Active" : "Inactive"}</span
    >
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
        <CopyButton text={$openAiConfig.siteId} />
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
</div>
