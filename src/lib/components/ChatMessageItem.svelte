<script lang="ts">
  import type { ChatMessage } from "$lib/db";
  import classNames from "classnames";
  import IconUserAvatar from "./IconUserAvatar.svelte";
  import SvelteMarkdown from "svelte-markdown";
  import IconBrain from "./IconBrain.svelte";
  import IconVerticalDots from "./IconVerticalDots.svelte";
  import CodeBlock from "./CodeBlock.svelte";
  import "./markdown.css";
  import { inProgressMessageId } from "$lib/stores/stores";
  let _class: string = "";
  export { _class as class };
  export let item: ChatMessage;
  let viewRaw = false;

  $: inProgress = $inProgressMessageId === item.id;

  /// For checking perf on these list items
  // onMount(() => {
  //   console.log("%cmounted", "color:salmon;font-size:18px;", item.id);
  // });
</script>

<div
  class={classNames("ChatMessage pr-2 group", _class)}
  data-message-id={item.id}
  data-role={item.role}
>
  <div class="Avatar text-zinc-400 pl-2 flex flex-col items-center space-y-4 relative top-1">
    {#if item.role === "user"}
      <IconUserAvatar class="w-5 h-5 sm:w-6 sm:h-6 opacity-60" />
    {:else if item.role === "assistant"}
      <IconBrain class="w-5 h-5 sm:w-6 sm:h-6 text-[#30CEC0] scale-[1.2]" />
      <div class="sm:group-hover:block hidden absolute -top-[16px]">
        <button
          on:click={(e) => {
            viewRaw = !viewRaw;
          }}
          class="hover:bg-white/20 hover:text-white rounded-full p-[2px]"
        >
          <IconVerticalDots class="scale-75" />
        </button>
      </div>
    {:else}
      <div class="w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center">
        <code class="text-xl inline-block">
          {"#"}
        </code>
      </div>
    {/if}
  </div>
  <div
    class={classNames("Content prose max-w-4xl prose-invert", {
      "opacity-60": item.role === "user",
      "has-cursor": $inProgressMessageId === item.id,
      // "has-cursor": true, // For debugging
    })}
  >
    {#if item.role === "user"}
      <!-- User input is not considered markdown, but whitespace should be respected -->
      <div class="whitespace-pre-wrap">{item.content}</div>
      <div class="text-zinc-400 text-xs mt-1">
        {item.createdAt.toLocaleTimeString()}
      </div>
    {:else}
      <!-- Only render markdown for bot responses -->
      {#if viewRaw}
        <div class="whitespace-pre-wrap">{item.content}</div>
      {:else}
        <SvelteMarkdown source={item.content} renderers={{ code: CodeBlock }} />
      {/if}
      {#if item.cancelled}
        <div class="text-zinc-400 text-xs -mt-2">Cancelled</div>
      {/if}
    {/if}
  </div>
</div>

<style>
  .Content {
    overflow: hidden; /* @note This is to prevent markdown content from overlfowing */
  }
  /* ChatMessage uses a grid layout, wtih the users avatar 32px squared on the left, and a 1fr content area on the right. only one row for now */
  .ChatMessage {
    @apply gap-2 sm:gap-6;
    display: grid;
    grid-template-columns: auto 1fr;
    grid-template-areas: "profile content";
    grid-template-rows: 1fr;
  }
  .ChatMessage[data-role="comment"] {
    @apply bg-teal-800/20 border-y border-teal-300/50 -mx-2 px-2 py-2;
  }
  .ChatMessage[data-role="comment"] .Avatar {
    @apply text-teal-300/30;
  }
  .ChatMessage[data-role="comment"] :global(p) {
    @apply text-teal-100;
  }
  .Avatar {
    grid-area: profile;
  }
  .has-cursor {
    @apply relative;
  }
  .has-cursor .blinking-cursor {
    @apply scale-y-75;
  }
  /* @note Global is important, otherwise this does not work */
  /* @note blockquote is an odd one, but it's because the blockquote has a p tag inside it */
  :global .has-cursor > *:last-child:not(ul):not(ol):not(blockquote):not(.CodeBlock)::after,
  :global .has-cursor > *:not(p):last-child > :last-child::after {
    @apply font-mono;
    content: "";
    display: inline-block;
    background-color: #18d4f1;
    width: 3px;
    border-radius: 3px;
    height: 1em;
    transform: scaleY(1.2);
    transition: opacity 0.3s;
    /* box-shadow: 0 0 10px #18d4f1, 0 0 20px #18d4f1, 0 0 30px #18d4f1, 0 0 40px #18d4f1; */
    box-shadow: 0 0 8px #18d4f1, 0 0 20px #18d4f1;
    animation: blinking 1.1s infinite;
  }
  @keyframes blinking {
    40% {
      opacity: 1;
    }
    50% {
      opacity: 0;
    }
    60% {
      opacity: 1;
    }
  }
</style>
