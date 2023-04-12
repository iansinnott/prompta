<script lang="ts">
  import type { ChatMessage } from "$lib/db";
  import classNames from "classnames";
  import IconUserAvatar from "./IconUserAvatar.svelte";
  import { onMount } from "svelte";
  import IconBrainAiHybrid from "./IconBrainAiHybrid.svelte";
  import IconBrain from "./IconBrain.svelte";
  let _class: string = "";
  export { _class as class };

  export let item: ChatMessage;

  /// For checking perf on these list items
  // onMount(() => {
  //   console.log("%cmounted", "color:salmon;font-size:18px;", item.id);
  // });
</script>

<div class={classNames("ChatMessage", _class)} data-message-id={item.id}>
  <div class="Avatar text-zinc-400 pl-2">
    {#if item.role === "user"}
      <IconUserAvatar class="opacity-60" />
    {:else}
      <IconBrain class="w-6 h-6 text-[#30CEC0] scale-[1.2]" />
    {/if}
  </div>
  <div
    class={classNames("Content", {
      "opacity-60": item.role === "user",
    })}
  >
    {item.content}
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
