<script lang="ts">
  import {
    currentChatThread,
    currentThread,
    generateThreadTitle,
    showSettings,
    threadMenu,
  } from "$lib/stores/stores";
  import { onMount, tick } from "svelte";
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
  import { getSystem } from "$lib/gui";
  import IconTerminalPrompt from "./IconTerminalPrompt.svelte";

  const sys = getSystem();
  let input: HTMLInputElement;
  let menuOpen = false;
  let filterText = "";
  let index = 0;

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
      altFilterText: "thread",
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
      keyboard: {
        shortcut: "meta+alt+i",
      },
      when: dev,
      name: "Devtools",
      execute: sys.toggleDevTools,
    },
    {
      when: dev,
      name: "Reset Current Chat",
      color: "red",
      altFilterText: "clear thread",
      execute: currentChatThread.deleteMessages,
    },
    {
      when: dev,
      name: "Reset Database",
      color: "red",
      execute: _clearDatabase,
    },
  ];

  function toggleMenu() {
    menuOpen = !menuOpen;
    if (menuOpen) {
      tick().then(() => input.focus());
    } else {
      // NOTE blur the input so that single-char shortcuts work
      if (input && input === document.activeElement) {
        input.blur();
      }
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
        shortcut: "/",
        when: () => {
          if (
            document.activeElement?.tagName === "INPUT" ||
            document.activeElement?.tagName === "TEXTAREA"
          ) {
            return;
          }

          return true;
        },
      },
      execute: () => {
        const el = document.querySelector<HTMLTextAreaElement>("[data-chat-input]");
        if (el) {
          el.focus();
        }
      },
    },
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
        index = Math.min(filteredActions.length - 1, index + 1);
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
      when: "when" in item ? item.when : true,
    };
  });

  // Keybindings
  // @todo These shuld maybe live somewhere else?
  function globalKeyPress(e: KeyboardEvent) {
    const shortcut = getShortcutFromEvent(e);
    if (knownShortcuts.has(shortcut)) {
      const handler = handlers.find((x) => x.when && x.predicate(e));
      if (handler) {
        e.preventDefault();
        handler.execute();
      }
    }
  }

  let scrollContainer: HTMLDivElement | null;

  $: {
    const el = scrollContainer?.querySelector(`[data-index="${index}"]`);
    if (el) {
      el.scrollIntoView({ block: "nearest" });
    }
  }

  // Clear filter text whenever the menu opens
  $: if (menuOpen) {
    filterText = "";
  }

  $: filteredActions = actionItems
    .filter((item) => item.when ?? true)
    .filter((item) => {
      return (
        item.name.toLowerCase().includes(filterText.toLowerCase()) ||
        item.altFilterText?.toLowerCase().includes(filterText.toLowerCase())
      );
    });
</script>

<svelte:window on:keydown={globalKeyPress} />

{#if menuOpen}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <div class="fixed inset-0 bg-transparent" on:click={toggleMenu} />
{/if}

<div class="relative">
  <button on:click={toggleMenu} class:active={menuOpen} class="font-bold px-4 py-2">Actions</button>
  {#if menuOpen}
    <div
      class="absolute bottom-[calc(100%+10px)] right-0 min-w-[425px] shadow-xl border border-zinc-700 bg-zinc-800 rounded-lg z-20 flex flex-col"
    >
      <div bind:this={scrollContainer} class="flex-1 max-h-[272px] overflow-auto my-2 px-2">
        {#each filteredActions as action, i (action.name)}
          <button
            data-index={i}
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
      </div>
      <div class="shrink-0">
        <input
          class="FilterInput py-3 px-4 border-t border-zinc-600"
          bind:value={filterText}
          on:input={() => (index = 0)}
          bind:this={input}
          type="text"
          placeholder="Search for actions..."
        />
      </div>
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
