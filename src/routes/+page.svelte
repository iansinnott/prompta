<script lang="ts">
  import { onMount, tick } from "svelte";
  import {
    currentThread,
    currentChatThread,
    gptProfileStore,
    openAiConfig,
    showSettings,
    syncStore,
  } from "../lib/stores/stores";
  import ThreadMenuList from "$lib/components/ThreadMenuList.svelte";
  import ThreadMenuButton from "$lib/components/ThreadMenuButton.svelte";
  import ChatMessageList from "$lib/components/ChatMessageList.svelte";
  import ActionsMenu from "$lib/components/ActionsMenu.svelte";
  import { getSystem } from "$lib/gui";
  import { dev } from "$app/environment";
  import IconTerminalPrompt from "$lib/components/IconTerminalPrompt.svelte";
  import classNames from "classnames";
  import IconSync from "$lib/components/IconSync.svelte";
  import CopyButton from "$lib/components/CopyButton.svelte";
  import qr from "@vkontakte/vk-qr";
  import { slide } from "svelte/transition";

  const sys = getSystem();
  let message = "";
  let textarea: HTMLTextAreaElement | null = null;

  const resizeChatInput = () => {
    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = textarea.scrollHeight + "px";
  };

  $: sending = $currentChatThread.status === "loading";

  async function handleSubmit(s: string) {
    if (sending) {
      console.debug("Cancelling");
      currentChatThread.cancel();
      return;
    }

    if (!$openAiConfig.apiKey) {
      await sys.alert(`No API key found. Please enter one in the settings.`);
      $showSettings = true;
      return;
    }

    s = s.trim();

    if (!s) {
      console.debug("No string. Not sending.");
      return;
    }

    await currentChatThread.sendMessage({
      threadId: $currentThread.id,
      role: "user",
      content: s,
    });

    message = "";
    await tick();
    resizeChatInput();
  }

  let syncString = "";

  $: if ($currentThread) {
    tick().then(() => {
      textarea?.focus();
    });
  }

  $: isConnectionActive = $syncStore.connection !== "";

  $: joinSyncUrl = `https://chat.prompta.dev?${new URLSearchParams().set(
    "syncChain",
    $openAiConfig.siteId
  )}`;
</script>

<div class:dev-container={dev} class={classNames("app-container", {})}>
  <header data-tauri-drag-region class="app-header p-4 pr-3 border-b border-zinc-700 w-full">
    <div class="Left flex items-center space-x-4">
      {#if sys.isTauri}
        <button
          class="text-zinc-200 p-1 rounded hover:bg-white/10 hover:text-white mr-4"
          on:click={(e) => {
            sys.AppWindow.close().catch(console.error);
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" class="w-5 h-5 scale-75">
            <path
              stroke="currentcolor"
              fill="currentcolor"
              d="M 7.21875 5.78125 L 5.78125 7.21875 L 14.5625 16 L 5.78125 24.78125 L 7.21875 26.21875 L 16 17.4375 L 24.78125 26.21875 L 26.21875 24.78125 L 17.4375 16 L 26.21875 7.21875 L 24.78125 5.78125 L 16 14.5625 Z"
            />
          </svg>
        </button>
      {/if}
      {#if dev}
        <div class="text-xs flex items-center border rounded border-yellow-400">
          <div
            class="bg-yellow-400 text-yellow-900 font-bold py-1 px-1 sm:px-2 inline-flex items-center"
          >
            <IconTerminalPrompt class="w-5 h-5 sm:mr-2" />
            <span class="text-sm hidden sm:inline-block font-mono">DEV</span>
          </div>
          <div class="py-1 px-4 font-bold text-yellow-400 uppercase hidden sm:block">
            {$gptProfileStore.model}
          </div>
        </div>
      {/if}
      <button
        style="animation-direction: reverse;"
        class={classNames("text-white/70 hover:text-white", {
          "animate-spin": false,
        })}
        on:click={() => {
          $syncStore.showSyncModal = !$syncStore.showSyncModal;
        }}
      >
        <IconSync
          class=""
          innerClass={classNames({
            "text-white": !isConnectionActive,
            "text-teal-400": isConnectionActive,
          })}
        />
      </button>
    </div>
    {#if $syncStore.showSyncModal}
      <div
        class="fixed top-16 left-0 right-0 sm:right-auto sm:w-[420px] sm:left-12 bg-zinc-600 rounded-lg p-3 shadow-lg z-10 space-y-4 overflow-auto max-h-[80vh]"
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
          {$syncStore.connection ? "Disconnect" : "Enable"}
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
              Enabling sync allows you to access your chats from multiple devices. This is done via
              peer-to-peer connection, so your chats are only sent directly to devices with your
              sync code.
            </small>
          </div>
        {:else}
          <div class="flex flex-col space-y-4" transition:slide|local={{ duration: 150 }}>
            <p>Copy the sync code below to share with your other devices.</p>
            <!-- <div class="rounded-lg bg-white p-4 flex justify-center">
            {@html qr.createQR(joinSyncUrl, { isShowLogo: false })}
          </div> -->
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
    {/if}
    <div class="Right flex items-center relative">
      <ThreadMenuButton />
      <ThreadMenuList />
    </div>
  </header>
  <div class="app-body sm:p-2">
    <ChatMessageList />
  </div>
  <!-- No padding top in order to let chat messages appaer to scroll behind -->
  <footer class="app-footer p-3 pt-0 relative -top-px">
    <form
      on:submit={(e) => {
        e.preventDefault();
        handleSubmit(message);
      }}
      class="flex items-end rounded-lg bg-zinc-800 border border-zinc-700"
    >
      <textarea
        data-chat-input
        on:keydown={(e) => {
          // send on enter
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(message);
          }
        }}
        bind:this={textarea}
        bind:value={message}
        on:input={(e) => {
          resizeChatInput();
        }}
        placeholder={sending ? "Enter to cancel" : "Ask GPT..."}
        rows="1"
        class="appearance-none flex-1 w-full px-4 py-2 bg-transparent outline-none resize-none"
      />
      <button class="font-bold px-4 py-2" type="submit">{sending ? "Cancel" : "Send"}</button>
      <ActionsMenu />
    </form>
  </footer>
</div>

<style>
  .dev-container {
    @apply border-2 border-yellow-600;
  }
  .app-container {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    grid-template-areas:
      "top"
      "middle"
      "bottom";

    /* Not sure where the extra height is from, but the specific calc fixes the layout */
    height: calc(100vh - 2px);
  }
  .app-header {
    grid-area: top;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    @apply gap-4 items-center sm:justify-items-end;
  }
  .app-body {
    grid-area: middle;
    overflow-y: scroll;
  }
  .app-footer {
    grid-area: bottom;
  }
</style>
