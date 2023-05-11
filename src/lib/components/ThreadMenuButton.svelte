<script lang="ts">
  import { threadMenu, currentThread, isNewThread } from "$lib/stores/stores";
  import classNames from "classnames";
  import IconChevronDown from "./IconChevronDown.svelte";
  import IconSparkle from "./IconSparkle.svelte";
  let _class: string = "";
  export { _class as class };
</script>

<button
  class={classNames(
    "border border-zinc-700 rounded-lg py-2 pl-4 pr-3 flex items-center w-full sm:w-full sm:max-w-[520px]",
    _class
  )}
  on:click={() => {
    $threadMenu.open = !$threadMenu.open;
  }}
>
  {#if isNewThread($currentThread)}
    <div class="relative top-[2px] left-px mr-2">
      <IconSparkle />
    </div>
  {/if}

  <div class="flex-1 w-full truncate text-left">{$currentThread.title}</div>
  <div class="scale-75 text-zinc-400 pl-4">
    <IconChevronDown />
  </div>
</button>
