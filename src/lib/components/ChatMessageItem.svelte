<script lang="ts">
  import type { ChatMessage } from "$lib/db";
  import classNames from "classnames";
  import IconUserAvatar from "./IconUserAvatar.svelte";
  import { onMount } from "svelte";
  import IconBrainAiHybrid from "./IconBrainAiHybrid.svelte";
  import SvelteMarkdown from "svelte-markdown";
  import IconBrain from "./IconBrain.svelte";
  import IconVerticalDots from "./IconVerticalDots.svelte";
  import CodeBlock from "./CodeBlock.svelte";
  import { isAssistantWriting } from "$lib/stores/stores";
  let _class: string = "";
  export { _class as class };
  export let item: ChatMessage;
  let viewRaw = false;

  /// For checking perf on these list items
  // onMount(() => {
  //   console.log("%cmounted", "color:salmon;font-size:18px;", item.id);
  // });
</script>

<div class={classNames("ChatMessage pr-2 group", _class)} data-message-id={item.id}>
  <div class="Avatar text-zinc-400 pl-2 flex flex-col items-center space-y-4">
    {#if item.role === "user"}
      <IconUserAvatar class="opacity-60" />
    {:else}
      <IconBrain class="w-6 h-6 text-[#30CEC0] scale-[1.2]" />
      <div class="group-hover:block hidden">
        <button
          on:click={(e) => {
            viewRaw = !viewRaw;
          }}
          class="hover:bg-white/20 hover:text-white rounded-full p-[2px]"
        >
          <IconVerticalDots class="scale-75" />
        </button>
      </div>
    {/if}
  </div>
  <div
    class={classNames("Content prose prose-invert", {
      "opacity-60": item.role === "user",
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
        <SvelteMarkdown
          source={item.content}
          renderers={$isAssistantWriting ? {} : { code: CodeBlock }}
        />
      {/if}
      {#if item.cancelled}
        <div class="text-zinc-400 text-xs -mt-2">Cancelled</div>
      {/if}
    {/if}
  </div>
</div>

<style>
  /* ChatMessage uses a grid layout, wtih the users avatar 32px squared on the left, and a 1fr content area on the right. only one row for now */
  .ChatMessage {
    @apply gap-6;
    display: grid;
    grid-template-columns: auto 1fr;
    grid-template-areas: "profile content";
    grid-template-rows: 1fr;
  }
  .Avatar {
    grid-area: profile;
  }
</style>
