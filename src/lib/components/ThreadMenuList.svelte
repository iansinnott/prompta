<script lang="ts">
  import { currentThread, threadList, threadMenu } from "$lib/stores/stores";
  import classNames from "classnames";
  import { onMount, tick } from "svelte";
  import IconSparkle from "./IconSparkle.svelte";
  import { groupBy } from "$lib/utils";
  let _class: string = "";
  export { _class as class };
  let input: HTMLInputElement;
  let scrollContainer: HTMLDivElement | null;
  let searchText = "";
  let index = 0;

  const humanizeDate = (date: Date) => {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const isToday = date.toDateString() === today.toDateString();
    const isYesterday = date.toDateString() === yesterday.toDateString();
    if (isToday) {
      return "Today";
    } else if (isYesterday) {
      return "Yesterday";
    } else {
      return date.toLocaleDateString();
    }
  };

  $: filteredThreads = $threadList.filter((x) =>
    x.title.toLowerCase().includes(searchText.toLowerCase())
  );

  $: threadGroups = Object.entries(groupBy(filteredThreads, (x) => humanizeDate(x.createdAt)));

  $: {
    // scroll the list to the current index
    const el = scrollContainer?.querySelector(`[data-index="${index}"]`);
    if (el) {
      el.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }

  // When the thread menu is opened...
  $: if ($threadMenu.open) {
    // Update the index to be the active thread
    const i = filteredThreads.findIndex((t) => t.id === $currentThread.id);
    if (i === -1 && filteredThreads.length > 0) {
      index = 0;
    } else {
      index = i;
    }

    // Automatically focus the input when opened
    tick().then(() => {
      input.focus();
    });
  } else {
    // Make sure the input is unfocused when closed, if it currently has focus
    // NOTE This is to allow single-key hotkeys (elsewhere in the app) that
    // require no-input to be focused
    if (input && document.activeElement === input) {
      input.blur();
    }
  }

  const openNewThread = () => {
    currentThread.reset();
    $threadMenu.open = false;
    searchText = "";
  };

  const openThread = () => {
    const t = filteredThreads[index];
    if (t) {
      $currentThread = t;
      $threadMenu.open = false;
      searchText = "";
    }
  };
</script>

<svelte:window
  on:keydown={(e) => {
    if (!$threadMenu.open) return;

    // if input has focus
    const hasFocus = document.activeElement === input;

    // @todo its somewhat messy having this here, considering most keyboard shortcuts are in the actions menu

    // use the arrow keys to move index up and down
    if (hasFocus && e.key === "ArrowDown") {
      e.preventDefault();
      index = Math.min(index + 1, filteredThreads.length - 1);
    } else if (hasFocus && e.key === "ArrowUp") {
      e.preventDefault();
      index = Math.max(index - 1, -1); // -1 is for the new chat button
    } else if (hasFocus && e.key === "Enter") {
      e.preventDefault();
      // select the current index
      if (index === -1) {
        openNewThread();
      } else if (filteredThreads.length > 0) {
        openThread();
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
    "absolute top-[calc(100%+10px)] w-dropdown rounded bg-zinc-800 border border-zinc-700 p-2",
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
  <div class="Separator h-px bg-zinc-700 my-2 -mx-2" />

  <!-- Scroll area -->
  <div bind:this={scrollContainer} class="overflow-auto max-h-[400px]">
    <button
      data-index="-1"
      on:mouseenter={(e) => (index = -1)}
      on:click={openNewThread}
      class={classNames("p-2 mb-1 rounded w-full text-left truncate flex cursor-default", {
        "bg-white/10": index === -1,
      })}
    >
      <span class="relative top-[2px] left-px mr-2">
        <IconSparkle />
      </span>
      <span> New Chat </span>
    </button>
    {#if filteredThreads.length > 0}
      <div class="Separator h-px bg-zinc-700 my-2" />
    {/if}
    {#each threadGroups as [dateString, threads], i (dateString)}
      <div class="text-zinc-500 text- mb-1 ml-2 pt-2 font-bold">{dateString}</div>
      {#each threads as t, j (t.id)}
        <!-- this is an ugly and inefficient way to get serial order, but svelte makes it hard. its not plain js -->
        {@const serialIndex = i ? threadGroups.slice(0, i).flatMap((x) => x[1]).length + j : j}
        <button
          data-index={serialIndex}
          on:click={openThread}
          on:mouseenter={(e) => (index = serialIndex)}
          class={classNames("p-2 mb-1 rounded block w-full text-left truncate", {
            "bg-white/10": index === serialIndex,
          })}
        >
          {t.title}
        </button>
      {/each}
    {/each}
  </div>
</div>

<style>
  .active {
    @apply hover:bg-white/10;
  }
</style>
