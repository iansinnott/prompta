<script lang="ts">
  import { tick } from "svelte";
  import { Configuration, OpenAIApi } from "openai";
  import type { ChatCompletionRequestMessage, ChatCompletionRequestMessageRoleEnum } from "openai";
  import { db, openAiConfig, sqlite } from "../lib/stores/stores";
  import initWasm from "@vlcn.io/crsqlite-wasm";
  import wasmUrl from "@vlcn.io/crsqlite-wasm/crsqlite.wasm?url";
  import { DB_NAME } from "../lib/constants";

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
</script>

<div class="p-2 chat-container">
  <header class="chat-header">
    <h1 class="text-2xl font-bold">SvelteKit Chat</h1>
  </header>
  <div class="chat-body">
    <h2>chat messages will go here</h2>
    <p>
      Lorem, ipsum dolor sit amet consectetur adipisicing elit. Cum laborum error assumenda quas
      earum eum dolorem saepe. Assumenda voluptatum culpa tenetur, eaque atque illum quo eum debitis
      vitae id dolorum.
    </p>
  </div>
  <div class="chat-input">
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
    grid-template-rows: auto 1fr auto;
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
