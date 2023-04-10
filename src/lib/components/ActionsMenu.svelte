<script lang="ts">
  import { onMount } from "svelte";
  let input: HTMLInputElement;
  let menuOpen = false;
  let filterText = "";
  let actionItems = [{ name: "Action 1" }, { name: "Action 2" }, { name: "Action 3" }];
  let index = 0;

  function toggleMenu() {
    menuOpen = !menuOpen;
    if (menuOpen) {
      setTimeout(() => input.focus(), 100);
    }
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

<div class="menu-container">
  <button on:click={toggleMenu} class="font-bold px-4 py-2">Actions</button>
  {#if menuOpen}
    <div
      class="absolute bottom-[calc(100%+20px)] right-0 min-w-[300px] shadow-lg border border-zinc-700 bg-zinc-800 rounded-lg pt-2"
    >
      {#each filteredActions as action, i (action.name)}
        <div
          on:mouseenter={() => (index = i)}
          class="rounded px-2 py-2 mx-2"
          class:active={i === index}
        >
          {action.name}
        </div>
      {/each}
      <input
        class="FilterInput py-3 mt-2 border-t border-zinc-600 px-2"
        bind:value={filterText}
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
