<script lang="ts">
  import { tick } from "svelte";
  import {
    currentThread,
    currentChatThread,
    gptProfileStore,
    openAiConfig,
    showSettings,
  } from "../lib/stores/stores";
  import ThreadMenuList from "$lib/components/ThreadMenuList.svelte";
  import ThreadMenuButton from "$lib/components/ThreadMenuButton.svelte";
  import ChatMessageList from "$lib/components/ChatMessageList.svelte";
  import ActionsMenu from "$lib/components/ActionsMenu.svelte";
  import { getSystem } from "$lib/gui";
  import { dev } from "$app/environment";
  import IconTerminalPrompt from "$lib/components/IconTerminalPrompt.svelte";
  import classNames from "classnames";

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

  $: if ($currentThread) {
    tick().then(() => {
      textarea?.focus();
    });
  }
</script>

<div class:dev-container={dev} class={classNames("app-container", {})}>
  <header data-tauri-drag-region class="app-header p-4 pr-3 border-b border-zinc-700 w-full">
    <div class="Left flex items-center">
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
    </div>
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
