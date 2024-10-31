<script lang="ts">
  import type { ChatMessage } from "$lib/db";
  import classNames from "classnames";
  import IconUserAvatar from "./IconUserAvatar.svelte";
  import SvelteMarkdown from "svelte-markdown";
  import IconBrain from "./IconBrain.svelte";
  import IconVerticalDots from "./IconVerticalDots.svelte";
  import CodeBlock from "./CodeBlock.svelte";
  import MarkdownHtmlBlock from "./MarkdownHtmlBlock.svelte";
  import "./markdown.css";
  import { currentlyEditingMessage, inProgressMessageId } from "$lib/stores/stores";
  import ChatMessageControls from "./ChatMessageControls.svelte";
  import { autosize } from "$lib/utils";
  import { slide } from "svelte/transition";
  import ImageAttachment from "./ImageAttachment.svelte";
  import ChatImageAttachment from "./ChatImageAttachment.svelte";
  let _class: string = "";
  export { _class as class };
  export let item: ChatMessage;

  let editableTextArea: HTMLTextAreaElement | null = null;

  // Used to give the markdown renderer something to render when there is no
  // content yet. Allows the blinking cursor to appear before tokens have
  // arrived. Serves as as loading state.
  const NBSP = "\u00A0";

  $: inProgress = $inProgressMessageId === item.id;
  $: isEditing = $currentlyEditingMessage?.id === item.id;

  let showControls = false;

  $: if (isEditing && editableTextArea) {
    editableTextArea.select();
  }

  /// For checking perf on these list items
  // onMount(() => {
  //   console.log("%cmounted", "color:salmon;", item.id);
  // });
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
  class={classNames("ChatMessage pr-2 group", _class)}
  data-message-id={item.id}
  data-role={item.role}
  on:click={() => {
    if (!isEditing && !inProgress) {
      showControls = !showControls;
    }
  }}
>
  <div class="Avatar text-zinc-400 pl-2 flex flex-col items-center space-y-4 relative top-[2px]">
    {#if item.role === "user"}
      <IconUserAvatar class="w-5 h-5 sm:w-6 sm:h-6 opacity-60" />
    {:else if item.role === "assistant"}
      <IconBrain class="w-5 h-5 sm:w-6 sm:h-6 text-[#30CEC0] scale-[1.2]" />
      <div class="sm:group-hover:block hidden absolute -top-[16px]">
        <button
          on:click={(e) => {
            console.log("clicked secret button");
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
    class={classNames("Content prose max-w-4xl prose-invert group transition-opacity", {
      // Something about the grid styling and the child styling. We want overflow hidden horizontally but not vertically.
      "overflow-hidden": item.content.length > 20,
      "opacity-60": item.role === "user" && !isEditing && !showControls,
      "has-cursor": $inProgressMessageId === item.id,
      // "has-cursor": true, // For debugging
    })}
  >
    {#if isEditing && $currentlyEditingMessage}
      <textarea
        use:autosize
        bind:this={editableTextArea}
        bind:value={$currentlyEditingMessage.content}
        on:keydown={(e) => {
          // send on enter
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            currentlyEditingMessage.commitUpdate();
          } else if (e.key === "Escape" && isEditing) {
            $currentlyEditingMessage = null;
          }
        }}
        rows="1"
        class="w-full bg-transparent outline-none resize-none mb-3"
      />
    {:else if item.role === "user"}
      {#if typeof item.content === "string" && item.content.startsWith("[")}
        {#each JSON.parse(item.content) as part}
          {#if part.type === "image_url"}
            <ChatImageAttachment imageUrl={part.image_url.url} {showControls} />
          {:else if part.type === "text"}
            <p class="whitespace-pre-wrap">{part.text}</p>
          {/if}
        {/each}
      {:else}
        <p class="whitespace-pre-wrap">{item.content}</p>
      {/if}
    {:else}
      <SvelteMarkdown
        source={item.content || NBSP}
        renderers={{
          code: CodeBlock,
          html: MarkdownHtmlBlock,
        }}
      />
    {/if}

    <!-- All this markup to accomplish a smooth animation -->
    {#if showControls}
      <div
        transition:slide={{ duration: 150 }}
        class="-mt-3"
        on:click={(e) => {
          e.stopPropagation();
        }}
      >
        <ChatMessageControls {item} />
      </div>
    {/if}
  </div>
</div>

<style>
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
    @apply font-mono relative top-0.5;
    content: "";
    display: inline-block;
    background-color: #18d4f1;
    width: 3px;
    border-radius: 3px;
    height: 1.2em;
    transform: scaleY(1.2);
    transition: opacity 0.3s;
    /* box-shadow: 0 0 10px #18d4f1, 0 0 20px #18d4f1, 0 0 30px #18d4f1, 0 0 40px #18d4f1; */
    box-shadow:
      0 0 8px #18d4f1,
      0 0 20px #18d4f1;
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
