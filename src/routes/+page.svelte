<script lang="ts">
  import { onDestroy, onMount, tick } from "svelte";
  import {
    currentThread,
    currentChatThread,
    gptProfileStore,
    openAiConfig,
    showSettings,
    syncStore,
    devStore,
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
  import { slide } from "svelte/transition";
  import IconClose from "$lib/components/IconClose.svelte";
  import CloseButton from "$lib/components/CloseButton.svelte";
  import { isMobile } from "$lib/utils";
  import IconPlus from "$lib/components/IconPlus.svelte";
  import { mapKeysToMacSymbols } from "$lib/keyboard/shortcuts";

  const sys = getSystem();
  let message = "";
  let textarea: HTMLTextAreaElement | null = null;

  // NOTE: This is exclusively for mobile. It seems there is no good way to
  // manage window height with CSS. perhaps more research would yeild a better
  // solution, but for now this works well enough in my limited testing on ios.
  let windowHeight = window.innerHeight;
  function updateWindowHeight() {
    const element = document.querySelector(".your-element");
    const innerHeight = window.innerHeight; // Get viewport height in pixels
    const targetPct = 100;
    windowHeight = innerHeight * (targetPct / 100);
  }

  onMount(() => {
    if (!isMobile()) {
      return;
    } else {
      console.warn("Mobile browser. Manually managing window height.");
    }

    window.addEventListener("DOMContentLoaded", updateWindowHeight, false);
    window.addEventListener("resize", updateWindowHeight, false);
    window.addEventListener("orientationchange", updateWindowHeight, false);
  });

  onDestroy(() => {
    if (!isMobile()) return;
    window.removeEventListener("DOMContentLoaded", updateWindowHeight, false);
    window.removeEventListener("resize", updateWindowHeight, false);
    window.removeEventListener("orientationchange", updateWindowHeight, false);
  });

  const resizeChatInput = () => {
    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = textarea.scrollHeight + "px";
  };

  $: sending = $currentChatThread.status === "loading";

  function parseCommand(s: string) {
    if (!s.startsWith("/")) {
      return {
        command: null,
        args: [s],
        valid: true,
      };
    }

    let [command, ...args] = s.slice(1).split(" ");
    let valid = true;

    switch (command) {
      // `/` and `//` both function as commentss
      case "":
      case "/":
        command = "comment";
        break;
      default:
        valid = false;
    }

    return {
      command,
      args,
      valid,
    };
  }

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

    const { command, args, valid } = parseCommand(s);

    if (!valid) {
      await sys.alert(`Invalid command: ${command}`);
      return;
    }

    if (command) {
      await currentChatThread.sendCommand({
        threadId: $currentThread.id,
        command,
        args,
      });
    } else {
      await currentChatThread.sendMessage({
        threadId: $currentThread.id,
        role: "user",
        content: args.join(" "),
      });
    }

    message = "";
    await tick();
    resizeChatInput();
  }

  let syncString = "";

  // Generally we don't auto-focus on mobile
  $: if ($currentThread) {
    tick().then(() => {
      !isMobile() && textarea?.focus();
    });
  }

  $: isCommand = message.startsWith("/");

  $: isConnectionActive = $syncStore.connection !== "";

  $: joinSyncUrl = `https://chat.prompta.dev?${new URLSearchParams().set(
    "syncChain",
    $openAiConfig.siteId
  )}`;
</script>

<div
  class:dev-container={dev && $devStore.showDebug}
  class={classNames("app-container", {
    "rounded-lg": sys.isTauri,
  })}
  style={isMobile() ? `height: ${windowHeight}px;` : ""}
>
  <header data-tauri-drag-region class="app-header p-4 pr-3 border-b border-zinc-700 w-full">
    <div data-tauri-drag-region class="Left flex items-center space-x-4">
      {#if sys.isTauri}
        <CloseButton
          onClick={(e) => {
            sys.AppWindow.close().catch(console.error);
          }}
        />
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
          class="w-[18px] h-[18px]"
          innerClass={classNames({
            "text-white": !isConnectionActive,
            "text-teal-400": isConnectionActive,
          })}
        />
      </button>
      <!-- a "click outside" div -->
      {#if $syncStore.showSyncModal}
        <!-- svelte-ignore a11y-click-events-have-key-events -->
        <div
          class="fixed inset-0 z-10"
          on:click={() => {
            $syncStore.showSyncModal = false;
          }}
        />
      {/if}
    </div>
    {#if $syncStore.showSyncModal}
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
              optional. Sync happens via peer-to-peer connection, so your chats are only sent
              directly to devices with your sync code.
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
    {/if}
    <div data-tauri-drag-region class="Middle flex items-center justify-center relative w-full">
      <ThreadMenuButton />
      <ThreadMenuList />
    </div>
    <div data-tauri-drag-region class="Right flex items-center">
      <button
        class="text-white/50 pr-2 sm:px-2 py-1 hover:text-white"
        on:click={() => {
          currentThread.reset();
        }}
      >
        <IconPlus class="w-5 h-5" />
      </button>
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
      class={classNames("flex items-end rounded-lg border border-zinc-700", {
        "shadow-[0_0_0_2px_#5baba4] bg-teal-800/20 text-teal-200": isCommand,
        "bg-zinc-800": !isCommand,
      })}
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
        placeholder={sending ? "Enter to cancel" : "Ask Prompta..."}
        rows="1"
        class={classNames(
          "appearance-none flex-1 w-full px-4 py-2 bg-transparent outline-none resize-none max-h-[50svh]"
        )}
      />
      <button
        class="font-bold px-4 py-2 flex items-center text-xs uppercase leading-[22px]"
        type="submit"
      >
        <span class="mr-2">
          {sending ? "Cancel" : "Send"}
        </span>
        <span class="hidden sm:inline-flex items-center space-x-1 text-white/40">
          <kbd style="font-family:system-ui, -apple-system;" class="text-xs">{"⮐"}</kbd>
        </span>
      </button>
      <ActionsMenu class="text-xs uppercase leading-[22px]" />
    </form>
  </footer>

  <!-- Decided not to go with this for now -->
  {#if false}
    <footer
      class="app-statusbar text-sm bg-white/5 border-t border-zinc-700 grid grid-cols-[minmax(0,1fr)_auto]"
    >
      <div>
        <!-- Currently empty -->
      </div>
      <div class="flex items-center space-x-4">
        <button class="uppercase text-xs tracking-wider px-2 py-2"> Send </button>
        <ActionsMenu class="uppercase text-xs tracking-wider px-2 py-0 " />
      </div>
    </footer>
  {/if}
</div>

<style>
  .dev-container {
    @apply border-2 border-yellow-600;
  }
  .app-container {
    display: grid;
    grid-template-rows:
      auto
      minmax(0, 1fr)
      auto
      auto;
    grid-template-areas:
      "top"
      "middle"
      "bottom"
      "statusbar";

    /* Not sure where the extra height is from, but the specific calc fixes the layout */
    /* NOTE This will be overwritten on mobile. See the manual height code above */
    height: calc(100vh - 2px);
  }
  .app-header {
    grid-area: top;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    @apply gap-4 items-center sm:justify-items-end;
  }
  .app-body {
    grid-area: middle;
    overflow-y: scroll;
  }
  .app-footer {
    grid-area: bottom;
  }
  .app-statusbar {
    grid-area: statusbar;
  }
</style>
