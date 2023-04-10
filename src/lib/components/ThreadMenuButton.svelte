<script lang="ts">
  import { threadMenu, thread, isNewThread } from "$lib/stores/stores";
  import classNames from "classnames";
  import IconChevronDown from "./IconChevronDown.svelte";
  import IconSparkle from "./IconSparkle.svelte";
  let _class: string = "";
  export { _class as class };
</script>

<button
  class={classNames(
    "border border-zinc-700 rounded-lg p-2 flex items-center min-w-[240px]",
    _class
  )}
  on:click={() => {
    $threadMenu.open = !$threadMenu.open;
  }}
>
  {#if isNewThread($thread)}
    <div class="relative top-[2px] left-px mr-2">
      <IconSparkle />
    </div>
  {/if}

  <div class="flex-1 w-full truncate text-left">{$thread.title}</div>
  <div class="scale-75 text-zinc-400 pl-4">
    <IconChevronDown />
  </div>
</button>
