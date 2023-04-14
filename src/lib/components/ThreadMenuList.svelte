<script lang="ts">
  import { currentThread, threadList, threadMenu } from "$lib/stores/stores";
  import classNames from "classnames";
  import { onMount, tick } from "svelte";
  import IconSparkle from "./IconSparkle.svelte";
  let _class: string = "";
  export { _class as class };
  let input: HTMLInputElement;
  let searchText = "";
  let index = 0;

  $: filteredThreads = $threadList.filter((x) =>
    x.title.toLowerCase().includes(searchText.toLowerCase())
  );

  // Automatically focus the input when opened
  $: if ($threadMenu.open) {
    tick().then(() => {
      input.focus();
    });
  }
</script>

<svelte:window
  on:keydown={(e) => {
    // use the arrow keys to move index up and down
    if (e.key === "ArrowDown") {
      console.log("JE");
      index = Math.min(index + 1, filteredThreads.length - 1);
    } else if (e.key === "ArrowUp") {
      index = Math.max(index - 1, 0);
    } else if (e.key === "Enter") {
      // select the current index
      if (filteredThreads.length > 0) {
        $currentThread = filteredThreads[index];
        $threadMenu.open = false;
      }
    }
  }}
/>

{#if $threadMenu.open}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <div
    on:click={(e) => ($threadMenu.open = false)}
    class="Overlay z-10 fixed inset-0 bg-transparent"
  />
{/if}

<div
  class={classNames(
    "z-20",
    "absolute top-[calc(100%+10px)] w-[70vw] rounded bg-zinc-800 border border-zinc-700 p-2",
    _class
  )}
  class:hidden={!$threadMenu.open}
>
  <input
    bind:this={input}
    bind:value={searchText}
    placeholder="Search Chats..."
    type="text"
    class="FilterInput"
  />
  <div class="Separator h-px bg-zinc-700 my-2" />
  <button
    on:click={(e) => {
      currentThread.reset();
      $threadMenu.open = false;
    }}
    class="p-2 mb-1 hover:bg-white/10 rounded w-full text-left truncate flex"
  >
    <span class="relative top-[2px] left-px mr-2">
      <IconSparkle />
    </span>
    <span> New Chat </span>
  </button>
  {#if filteredThreads.length > 0}
    <div class="Separator h-px bg-zinc-700 my-2" />
  {/if}
  {#each filteredThreads as t, i (t.id)}
    {@const active = t.id === $currentThread.id || index === i}
    <button
      on:click={(e) => {
        $currentThread = t;
        $threadMenu.open = false;
      }}
      class={classNames("p-2 mb-1 hover:bg-white/10 rounded block w-full text-left truncate", {
        "bg-white/10": active,
      })}
    >
      {t.title}
    </button>
  {/each}
</div>
