<script lang="ts">
  import { currentChatThread, currentThread, showSettings } from "$lib/stores/stores";
  import { onMount } from "svelte";
  import IconSparkle from "./IconSparkle.svelte";
  import IconGear from "./IconGear.svelte";
  let input: HTMLInputElement;
  let menuOpen = false;
  let filterText = "";
  let actionItems = [
    {
      name: "New Chat",
      icon: IconSparkle,
      execute: () => {
        currentThread.reset();
      },
    },
    {
      name: "Settings",
      icon: IconGear,
      execute: () => {
        $showSettings = true;
      },
    },
  ];
  let index = 0;

  function toggleMenu() {
    menuOpen = !menuOpen;
    if (menuOpen) {
      setTimeout(() => input.focus(), 100);
    }
  }

  function executeCurrentAction() {
    filteredActions[index].execute();
    toggleMenu();
    index = 0;
    filterText = "";
  }

  function globalKeyPress(e: KeyboardEvent) {
    if (e.key.toLowerCase() === "k" && e.metaKey && !e.shiftKey && !e.altKey && !e.ctrlKey) {
      e.preventDefault();
      toggleMenu();
    }
    if (e.key === "ArrowUp" && !e.metaKey && !e.shiftKey && !e.altKey && !e.ctrlKey) {
      e.preventDefault();
      index = Math.max(0, index - 1);
    }
    if (e.key === "ArrowDown" && !e.metaKey && !e.shiftKey && !e.altKey && !e.ctrlKey) {
      e.preventDefault();
      index = Math.min(actionItems.length - 1, index + 1);
    }

    if (e.key === "Enter" && !e.metaKey && !e.shiftKey && !e.altKey && !e.ctrlKey && menuOpen) {
      e.preventDefault();
      executeCurrentAction();
    }

    if (e.key === "Escape" && menuOpen) {
      toggleMenu();
    }
  }

  onMount(() => {
    document.addEventListener("keydown", globalKeyPress);
    return () => {
      document.removeEventListener("keydown", globalKeyPress);
    };
  });

  $: filteredActions = actionItems.filter((item) =>
    item.name.toLowerCase().includes(filterText.toLowerCase())
  );
</script>

{#if menuOpen}
  <div class="fixed inset-0 bg-transparent" on:click={toggleMenu} />
{/if}

<div class="menu-container">
  <button on:click={toggleMenu} class="font-bold px-4 py-2">Actions</button>
  {#if menuOpen}
    <div
      class="absolute bottom-[calc(100%+10px)] right-0 min-w-[300px] shadow-lg border border-zinc-700 bg-zinc-800 rounded-lg pt-2 px-2"
    >
      {#each filteredActions as action, i (action.name)}
        <button
          on:mouseenter={() => (index = i)}
          on:click={executeCurrentAction}
          class="rounded px-2 py-2 flex w-full items-center"
          class:active={i === index}
        >
          {#if action.icon}
            <span class="w-6 h-6 mr-2 inline-flex items-center">
              <svelte:component this={action.icon} />
            </span>
          {/if}
          {action.name}
        </button>
      {/each}
      <input
        class="FilterInput py-3 mt-2 border-t border-zinc-600 px-2"
        bind:value={filterText}
        on:input={() => (index = 0)}
        bind:this={input}
        type="text"
        placeholder="Search for actions..."
      />
    </div>
  {/if}
</div>

<style>
  .menu-container {
    position: relative;
  }
  .active {
    @apply bg-white/10;
  }
</style>
