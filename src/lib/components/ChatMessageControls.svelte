<script lang="ts">
  import classNames from "classnames";
  import CopyButton from "./CopyButton.svelte";
  import type { ChatMessage } from "$lib/db";
  import { ThumbsUp, ThumbsDown, Pencil, Trash } from "lucide-svelte";
  let _class: string = "";
  export { _class as class };
  export let item: ChatMessage;
</script>

<div class={classNames("flex space-x-3 items-center", _class)}>
  {#if item.cancelled}
    <div class="text-zinc-400 text-xs">Cancelled</div>
  {/if}
  <div class="flex space-x-3 opacity-0 group-hover:opacity-100">
    <!-- Although this is not a big deal, i want to refactor this so that the item
         content isn't copied over to the copy button until clicked -->
    <CopyButton
      size="18px"
      class="text-white/40 hover:text-white outline-none"
      text={item.content}
    />
    <button
      type="button"
      class=""
      on:click={() => {
        console.log("edit");
      }}
    >
      <Pencil class="w-[18px] h-[18px] text-white/40 hover:text-white" />
    </button>
    <button
      type="button"
      class=""
      on:click={() => {
        console.log("remove");
      }}
    >
      <Trash class="w-[18px] h-[18px] text-white/40 hover:text-red-500" />
    </button>
  </div>
</div>
