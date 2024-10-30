<script lang="ts">
  import { onDestroy, onMount, tick } from "svelte";
  import {
    currentThread,
    currentChatThread,
    syncStore,
    devStore,
    showInitScreen,
    messageText,
    pendingMessageStore,
    isNewThread,
  } from "$lib/stores/stores";
  import { ArrowUpCircle, XCircle } from "lucide-svelte";
  import ThreadMenuList from "$lib/components/ThreadMenuList.svelte";
  import SmallSpinner from "$lib/components/SmallSpinner.svelte";
  import ThreadMenuButton from "$lib/components/ThreadMenuButton.svelte";
  import ChatMessageList from "$lib/components/ChatMessageList.svelte";
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
  import ModelPicker from "$lib/components/ModelPicker.svelte";
  import { chatModels } from "$lib/stores/stores/llmProvider";
  import ImageAttachment from "$lib/components/ImageAttachment.svelte";

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
  $: isPending = Boolean($pendingMessageStore?.content);

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
    if (isPending) {
      console.debug("Cancelling");
      currentChatThread.cancel();
      return;
    }

    s = s.trim();

    if (!s) {
      console.debug("No string. Not sending.");
      toast({
        type: "error",
        title: "Message is empty",
        message: "Please enter a message to send.",
      });
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

  $: hasModels = $chatModels.models.length > 0;
  $: placeholder = !hasModels ? "Loading..." : sending ? "Enter to cancel" : "Ask Prompta...";

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

      <ModelPicker />

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
          if (!isNewThread({ id: $currentThread.id })) {
            currentThread.reset();
            toast({ type: "success", title: "Started new thread" });
          }
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
    class={classNames("app-footer p-3 pt-0 relative -top-px flex w-full items-center space-x-3", {
      "pb-14": sys.isPWAInstalled,
    })}
  >
    <form
      on:submit={(e) => {
        e.preventDefault();
        handleSubmit($messageText);
      }}
      class={classNames("flex flex-1 items-end rounded-lg border border-zinc-700", {
        "shadow-[0_0_0_2px_#5baba4] bg-teal-800/20 text-teal-200": isCommand,
        "bg-zinc-800": !isCommand,
      })}
    >
      <ImageAttachment />

      <textarea
        data-chat-input
        data-testid="ChatInput"
        disabled={!hasModels}
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
        {placeholder}
        rows="1"
        class={classNames(
          "appearance-none flex-1 w-full px-4 py-2 bg-transparent outline-none resize-none max-h-[50svh]"
        )}
      />
      {#if !hasModels}
        <div data-testid="ModelsLoading" class="flex items-center justify-center px-4 py-2">
          <SmallSpinner />
        </div>
      {:else}
        <button
          data-testid="ChatInputSubmit"
          class="font-bold pl-4 pr-2 py-2 flex items-center text-xs uppercase leading-[22px]"
          type="submit"
        >
          {#if isPending}
            <span class="mr-2"> Cancel </span>
          {/if}
          <span class="inline-flex items-center space-x-1 text-white">
            {#if isPending}
              <XCircle size={24} />
            {:else}
              <ArrowUpCircle size={24} />
            {/if}
          </span>
        </button>
      {/if}
    </form>
    <!-- This is a placeholder for the actions menu, which is absolutely positioned at the layout level -->
    <div class="w-[42px] h-[42px]"></div>
  </footer>

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
  .dev-container:before {
    content: "";
    @apply absolute inset-0 border-2 border-yellow-600 pointer-events-none;
  }
  .app-container {
    position: relative;
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
