<script lang="ts">
  import { tick } from "svelte";
  import { Configuration, OpenAIApi } from "openai";
  import type { ChatCompletionRequestMessage, ChatCompletionRequestMessageRoleEnum } from "openai";
  import { db, openAiConfig, sqlite, thread } from "../lib/stores/stores";
  import initWasm from "@vlcn.io/crsqlite-wasm";
  import wasmUrl from "@vlcn.io/crsqlite-wasm/crsqlite.wasm?url";
  import { DB_NAME } from "../lib/constants";
  import IconSparkle from "$lib/components/IconSparkle.svelte";
  import IconChevronDown from "$lib/components/IconChevronDown.svelte";

  let initialLoad = true;
  let message = "";
  let textarea: HTMLTextAreaElement | null = null;
  let configuration: Configuration;
  let openai: OpenAIApi;

  const initDb = async () => {
    $sqlite = await initWasm(() => wasmUrl);
    $db = await $sqlite.open(DB_NAME);
  };

  const initOpenAi = () => {
    configuration = new Configuration({
      apiKey: $openAiConfig.apiKey,
    });
    openai = new OpenAIApi(configuration);
  };

  const resizeChatInput = () => {
    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = textarea.scrollHeight + "px";
  };

  async function handleSubmit(s: string) {
    console.log("Should submit: ", s);
    message = "";
    await tick();
    resizeChatInput();
  }

  let showThreadDropdown = false;
</script>

<div class="chat-container">
  <header class="chat-header p-4 flex items-center justify-between border-b border-zinc-700 w-full">
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
      <button
        class="border border-zinc-700 rounded-lg p-2 flex items-center min-w-[240px]"
        on:click={() => {
          showThreadDropdown = !showThreadDropdown;
        }}
      >
        {#if $thread.id === "new-thread"}
          <div class="relative top-[2px] left-px mr-2">
            <IconSparkle />
          </div>
        {/if}

        <div class="flex-1 w-full truncate text-left">{$thread.title}</div>
        <div class="scale-75 text-zinc-400 pl-4">
          <IconChevronDown />
        </div>
      </button>

      <div
        class="absolute top-full w-[70vw] rounded bg-zinc-800 border border-zinc-700 p-2"
        class:hidden={!showThreadDropdown}
      >
        {#each [{ id: "test1", title: "Testing threads" }, { id: "test2", title: "果冻是人民最爱的零食" }, { id: "test3", title: "here is some much longer text that will need to be truncated to fit in the UI" }] as t (t.id)}
          <button
            on:click={(e) => {
              $thread = t;
            }}
            class="p-2 hover:bg-white/10 rounded block w-full text-left truncate"
          >
            {t.title}
          </button>
        {/each}
      </div>
    </div>
  </header>
  <div class="chat-body p-2">
    <h2>chat messages will go here</h2>
    <p>
      Lorem, ipsum dolor sit amet consectetur adipisicing elit. Cum laborum error assumenda quas
      earum eum dolorem saepe. Assumenda voluptatum culpa tenetur, eaque atque illum quo eum debitis
      vitae id dolorum.
    </p>
  </div>
  <div class="chat-input p-3 border-b border-zinc-700 relative -top-px rounded-lg">
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
        placeholder="Type your message here"
        rows="1"
        class="appearance-none flex-1 w-full px-4 py-2 bg-transparent outline-none resize-none"
      />
      <button class="font-bold px-4 py-2" type="submit">Send</button>
    </form>
  </div>
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
