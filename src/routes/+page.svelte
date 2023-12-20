<script lang="ts">
  import { onDestroy, onMount, tick } from "svelte";
  import {
    currentThread,
    currentChatThread,
    openAiConfig,
    showSettings,
    syncStore,
    devStore,
    showInitScreen,
    messageText,
  } from "../lib/stores/stores";
  import ThreadMenuList from "$lib/components/ThreadMenuList.svelte";
  import ThreadMenuButton from "$lib/components/ThreadMenuButton.svelte";
  import ChatMessageList from "$lib/components/ChatMessageList.svelte";
  import ActionsMenu from "$lib/components/ActionsMenu.svelte";
  import { getSystem } from "$lib/gui";
  import { dev } from "$app/environment";
  import classNames from "classnames";
  import IconSync from "$lib/components/IconSync.svelte";
  import { fly } from "svelte/transition";
  import CloseButton from "$lib/components/CloseButton.svelte";
  import { isMobile } from "$lib/utils";
  import IconPlus from "$lib/components/IconPlus.svelte";
  import InitScreen from "$lib/components/InitScreen.svelte";
  import { toast } from "$lib/toast";
  import SyncModal from "$lib/components/SyncModal.svelte";

  const sys = getSystem();
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

    s = s.trim();

    if (!s) {
      console.debug("No string. Not sending.");
      toast({ type: "error", title: "No message" });
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

    await tick();
    resizeChatInput();
  }

  // Generally we don't auto-focus on mobile
  $: if ($currentThread) {
    tick().then(() => {
      !isMobile() && textarea?.focus();
    });
  }

  $: isCommand = $messageText.startsWith("/");

  $: isConnectionActive = $syncStore.connection !== "";

  $: if ($syncStore.error) console.log("sync store ERR", $syncStore.error);

  const isSyncSupported = true;
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

      {#if isSyncSupported}
        <button
          style="animation-direction: reverse;"
          class={classNames("text-white/70 hover:text-white", {
            "animate-spin": $syncStore.status === "syncing",
          })}
          on:click={() => {
            $syncStore.showSyncModal = !$syncStore.showSyncModal;
          }}
        >
          <IconSync
            class="w-[18px] h-[18px]"
            innerClass={classNames({
              "text-white": !$syncStore.error && !isConnectionActive,
              "text-teal-400": !$syncStore.error && isConnectionActive,
              "text-red-500": Boolean($syncStore.error) && isConnectionActive,
              "text-yellow-500 animate-pulse": $syncStore.status === "syncing",
            })}
          />
        </button>
      {/if}

      <!-- a "click outside" div -->
      {#if $syncStore.showSyncModal}
        <!-- svelte-ignore a11y-no-static-element-interactions -->
        <div
          class="fixed inset-0 z-10"
          on:click={() => {
            $syncStore.showSyncModal = false;
          }}
        />
      {/if}
    </div>

    {#if $syncStore.showSyncModal}
      <SyncModal />
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
  <footer
    class={classNames("app-footer p-3 pt-0 relative -top-px", {
      "pb-14": sys.isPWAInstalled,
    })}
  >
    <form
      on:submit={(e) => {
        e.preventDefault();
        handleSubmit($messageText);
      }}
      class={classNames("flex items-end rounded-lg border border-zinc-700", {
        "shadow-[0_0_0_2px_#5baba4] bg-teal-800/20 text-teal-200": isCommand,
        "bg-zinc-800": !isCommand,
      })}
    >
      <textarea
        data-chat-input
        data-testid="ChatInput"
        on:keydown={(e) => {
          // send on enter
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit($messageText);
          }
        }}
        bind:this={textarea}
        bind:value={$messageText}
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
        data-testid="ChatInputSubmit"
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
  {#if $showInitScreen}
    <div
      out:fly|global={{ duration: 200, opacity: 0, delay: 300 }}
      class="fixed inset-0 z-30 bg-zinc-800 rounded-lg"
    >
      <InitScreen />
    </div>
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
