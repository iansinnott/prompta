<script lang="ts">
  import { tick } from "svelte";
  import { currentThread, currentChatThread } from "../lib/stores/stores";
  import ThreadMenuList from "$lib/components/ThreadMenuList.svelte";
  import ThreadMenuButton from "$lib/components/ThreadMenuButton.svelte";
  import ChatMessageList from "$lib/components/ChatMessageList.svelte";
  import ActionsMenu from "$lib/components/ActionsMenu.svelte";

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
      currentChatThread.cancel();
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

<div class="chat-container">
  <header
    data-tauri-drag-region
    class="chat-header p-4 flex items-center justify-between border-b border-zinc-700 w-full"
  >
    <button
      class="text-zinc-200 p-1 rounded hover:bg-white/10 hover:text-white mr-4"
      on:click={(e) => {
        console.log("CLose");
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
    <div class="flex-1 flex justify-end relative">
      <ThreadMenuButton />
      <ThreadMenuList />
    </div>
  </header>
  <div class="chat-body p-2">
    <ChatMessageList />
  </div>
  <!-- No padding top in order to let chat messages appaer to scroll behind -->
  <footer class="chat-input p-3 pt-0 border-b border-zinc-700 relative -top-px">
    <form
      on:submit={(e) => {
        e.preventDefault();
        handleSubmit(message);
      }}
      class="flex items-end rounded-lg bg-zinc-800 border border-zinc-700"
    >
      <textarea
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
        placeholder={sending ? "Enter to cancel" : "Ask GPT something..."}
        rows="1"
        class="appearance-none flex-1 w-full px-4 py-2 bg-transparent outline-none resize-none"
      />
      <button class="font-bold px-4 py-2" type="submit">{sending ? "Cancel" : "Send"}</button>
      <ActionsMenu />
    </form>
  </footer>
</div>

<style>
  .chat-container {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    grid-template-areas:
      "top"
      "middle"
      "bottom";
    height: 100vh;
  }
  .chat-header {
    grid-area: top;
  }
  .chat-body {
    grid-area: middle;
    overflow-y: scroll;
  }
  .chat-input {
    grid-area: bottom;
  }
</style>
