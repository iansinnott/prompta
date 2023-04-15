<script lang="ts">
  import {
    currentChatThread,
    currentThread,
    generateThreadTitle,
    showSettings,
    threadMenu,
  } from "$lib/stores/stores";
  import { onMount } from "svelte";
  import IconSparkle from "./IconSparkle.svelte";
  import IconGear from "./IconGear.svelte";
  import IconHistoryClock from "./IconHistoryClock.svelte";
  import { dev } from "$app/environment";
  import { ChatMessage, _clearDatabase } from "$lib/db";
  import IconThreadTitle from "./IconThreadTitle.svelte";
  import IconRefresh from "./IconRefresh.svelte";
  import IconRefreshOutline from "./IconRefreshOutline.svelte";
  import {
    createShortcutPredicate,
    getShortcutFromEvent,
    mapKeysToMacSymbols,
  } from "$lib/keyboard/shortcuts";
  let input: HTMLInputElement;
  let menuOpen = false;
  let filterText = "";

  // Clear filter text whenever the menu opens
  $: if (menuOpen) {
    filterText = "";
  }

  const isMenuActive = () => menuOpen && input === document.activeElement;

  let actionItems = [
    {
      name: "Generate Title...",
      icon: IconThreadTitle,
      execute: () => {
        generateThreadTitle({ threadId: $currentThread.id });
      },
    },
    {
      name: "Regenerate Response",
      icon: IconRefreshOutline,
      execute: currentChatThread.regenerateResponse,
    },
    {
      name: "Chat History",
      icon: IconHistoryClock,
      keyboard: {
        shortcut: "meta+p",
      },
      execute: () => ($threadMenu.open = !$threadMenu.open),
    },
    {
      name: "New Chat",
      icon: IconSparkle,
      keyboard: {
        shortcut: "meta+n", // @note Only works in the Tauri app. In a browser the browser takes precedence
      },
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
    {
      when: dev,
      name: "Reload Window",
      execute: () => {
        window.location.reload();
      },
    },
    {
      when: dev,
      name: "Reset Current Thread",
      color: "red",
      execute: currentChatThread.deleteMessages,
    },
    {
      when: dev,
      name: "Reset Database",
      color: "red",
      execute: _clearDatabase,
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
    const action = filteredActions[index];
    if (action) {
      action.execute();
      toggleMenu();
      index = 0;
      filterText = "";
    }
  }

  const additionalActions = [
    {
      keyboard: {
        shortcut: "meta+k",
      },
      execute: toggleMenu,
    },
    {
      keyboard: {
        shortcut: "enter",
        when: isMenuActive,
      },
      execute: executeCurrentAction,
    },
    {
      keyboard: {
        shortcut: "escape",
        when: () => menuOpen || $threadMenu.open,
      },
      execute: () => {
        if ($threadMenu.open) {
          $threadMenu.open = false;
        }

        if (menuOpen) {
          toggleMenu();
        }
      },
    },
    {
      keyboard: {
        shortcut: "arrowup",
        when: isMenuActive,
      },
      execute: () => {
        index = Math.max(0, index - 1);
      },
    },
    {
      keyboard: {
        shortcut: "arrowdown",
        when: isMenuActive,
      },
      execute: () => {
        index = Math.min(actionItems.length - 1, index + 1);
      },
    },
  ];

  const actions = [...actionItems.filter((x) => x.keyboard?.shortcut), ...additionalActions];
  const knownShortcuts = new Set(actions.map((item) => item.keyboard?.shortcut as string));
  const handlers = actions.map((item) => {
    const shortcutPred = createShortcutPredicate(item.keyboard?.shortcut as string);
    return {
      // @ts-ignore
      predicate: (e: KeyboardEvent) => shortcutPred(e) && (item.keyboard?.when ?? (() => true))(),
      execute: item.execute,
    };
  });

  // Keybindings
  // @todo These shuld maybe live somewhere else?
  function globalKeyPress(e: KeyboardEvent) {
    const shortcut = getShortcutFromEvent(e);
    if (knownShortcuts.has(shortcut)) {
      e.preventDefault();
      const handler = handlers.find((handler) => handler.predicate(e));
      if (handler) {
        handler.execute();
      }
    }
  }

  onMount(() => {
    document.addEventListener("keydown", globalKeyPress);
    return () => {
      document.removeEventListener("keydown", globalKeyPress);
    };
  });

  $: filteredActions = actionItems
    .filter((item) => item.when ?? true)
    .filter((item) => item.name.toLowerCase().includes(filterText.toLowerCase()));
</script>

{#if menuOpen}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <div class="fixed inset-0 bg-transparent" on:click={toggleMenu} />
{/if}

<div class="relative">
  <button on:click={toggleMenu} class:active={menuOpen} class="font-bold px-4 py-2">Actions</button>
  {#if menuOpen}
    <div
      class="absolute bottom-[calc(100%+10px)] right-0 min-w-[425px] shadow-lg border border-zinc-700 bg-zinc-800 rounded-lg pt-2 px-2 z-20"
    >
      {#each filteredActions as action, i (action.name)}
        <button
          on:mouseenter={() => (index = i)}
          on:click={executeCurrentAction}
          class="rounded px-2 py-2 flex w-full items-center"
          class:active={i === index}
          class:danger={action.color === "red"}
        >
          {#if action.icon}
            <span class="w-6 h-6 mr-2 inline-flex items-center">
              <svelte:component this={action.icon} />
            </span>
          {/if}
          <span class="flex-1 flex">
            {action.name}
          </span>
          {#if action.keyboard?.shortcut}
            <span class="flex items-center space-x-1">
              {#each mapKeysToMacSymbols(action.keyboard.shortcut) as key}
                <kbd
                  style="font-family:system-ui, -apple-system;"
                  class="bg-white/20 inline-flex items-center justify-center rounded font-mono w-6 h-6 text-sm"
                  >{key}</kbd
                >
              {/each}
            </span>
          {/if}
        </button>
      {:else}
        <div class="text-zinc-500 text-sm px-2 py-2">No actions found</div>
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
  .active {
    @apply bg-white/10;
  }
  .danger {
    @apply text-red-400;
  }
</style>
