<script lang="ts">
  import {
    currentChatThread,
    currentThread,
    devStore,
    generateThreadTitle,
    isNewThread,
    showInitScreen,
    showSettings,
    syncStore,
    threadMenu,
  } from "$lib/stores/stores";
  import { tick } from "svelte";
  import IconSparkle from "./IconSparkle.svelte";
  import IconGear from "./IconGear.svelte";
  import IconHistoryClock from "./IconHistoryClock.svelte";
  import { dev } from "$app/environment";
  import { _clearDatabase, reinstatePriorData } from "$lib/db";
  import IconThreadTitle from "./IconThreadTitle.svelte";
  import IconRefreshOutline from "./IconRefreshOutline.svelte";
  import {
    createShortcutPredicate,
    getShortcutFromEvent,
    mapKeysToMacSymbols,
  } from "$lib/keyboard/shortcuts";
  import { getSystem } from "$lib/gui";
  import IconTerminalPrompt from "./IconTerminalPrompt.svelte";
  import IconArchiveIn from "./IconArchiveIn.svelte";
  import IconArchiveOut from "./IconArchiveOut.svelte";
  import { isMobile } from "$lib/utils";
  import classNames from "classnames";
  import IconTrash from "./IconTrash.svelte";
  import { toast } from "$lib/toast";
  import { chatModels, llmProviders, modelPickerOpen } from "$lib/stores/stores/llmProvider";
  import IconOpenAi from "./IconOpenAI.svelte";
  import IconBrain from "./IconBrain.svelte";
  import { Atom, Command as CommandIcon, FlaskConical, Flag } from "lucide-svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { featureFlags } from "$lib/featureFlags";
  let _class: string = "";
  export { _class as class };

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
      when: () => $page.url.pathname === "/",
      execute: () => {
        generateThreadTitle({ threadId: $currentThread.id }).catch((error) => {
          toast({
            type: "error",
            title: "Error generating title",
            message: error.message,
          });
        });
      },
    },
    {
      name: "Regenerate Response",
      when: () => $page.url.pathname === "/",
      icon: IconRefreshOutline,
      execute: currentChatThread.regenerateResponse,
    },
    {
      name: "Enable OpenAI",
      when: () => {
        const oai = llmProviders.getOpenAi();
        return !oai.apiKey && oai.enabled && $page.url.pathname === "/";
      },
      icon: IconOpenAi,
      execute: () => {
        showInitScreen.set(true);
      },
    },
    {
      when: () => !sys.isBrowser && $page.url.pathname === "/",
      name: "Chat History",
      icon: IconHistoryClock,
      keyboard: { shortcut: "meta+p" },
      execute: () => ($threadMenu.open = !$threadMenu.open),
    },
    {
      when: () => sys.isBrowser && $page.url.pathname === "/",
      name: "Chat History",
      icon: IconHistoryClock,
      keyboard: { shortcut: "ctrl+p" },
      execute: () => ($threadMenu.open = !$threadMenu.open),
    },

    {
      when: () => !sys.isBrowser && $page.url.pathname === "/",
      name: "New Chat",
      icon: IconSparkle,
      keyboard: { shortcut: "meta+n" }, // NOTE Meta key with N only works in the Tauri app. In a browser this opens a new window
      altFilterText: "thread",
      execute: currentThread.reset,
    },
    {
      when: () => sys.isBrowser && $page.url.pathname === "/",
      name: "New Chat",
      icon: IconSparkle,
      keyboard: { shortcut: "ctrl+n" },
      altFilterText: "thread",
      execute: currentThread.reset,
    },

    {
      when: () => !sys.isBrowser && $page.url.pathname === "/",
      name: "Choose LLM Model",
      icon: IconBrain,
      keyboard: { shortcut: "meta+l" }, // NOTE Meta key with N only works in the Tauri app. In a browser this opens a new window
      altFilterText: "thread",
      execute: () => {
        $modelPickerOpen = !$modelPickerOpen;
      },
    },
    {
      when: () => sys.isBrowser && $page.url.pathname === "/",
      name: "Choose LLM Model",
      icon: IconBrain,
      keyboard: { shortcut: "ctrl+l" },
      altFilterText: "thread",
      execute: () => {
        $modelPickerOpen = !$modelPickerOpen;
      },
    },

    {
      name: "Archive Chat",
      icon: IconArchiveIn,
      when: () =>
        !$currentThread.archived && !isNewThread($currentThread) && $page.url.pathname === "/",
      execute: currentThread.archive,
    },
    {
      name: "Unarchive Chat",
      icon: IconArchiveOut,
      when: () => $currentThread.archived && $page.url.pathname === "/",
      execute: currentThread.unarchive,
    },
    {
      name: "Settings",
      icon: IconGear,
      execute: () => {
        $showSettings = true;
      },
    },
    {
      name: "Back to chat",
      icon: IconBrain,
      when: () => $page.url.pathname !== "/",
      execute: () => {
        goto("/");
      },
    },
    {
      name: "Feature Flags",
      icon: Flag,
      altFilterText: "beta alpha experimental lab",
      when: () => $page.url.pathname !== "/dev/feature-flags",
      execute: () => {
        goto("/dev/feature-flags");
      },
    },
    {
      name: "Dev Experiments",
      icon: FlaskConical,
      when: () => $page.url.pathname !== "/dev" && featureFlags.check("dev_experiments"),
      execute: () => {
        goto("/dev");
      },
    },
    {
      name: "Refresh Models List",
      icon: IconRefreshOutline,
      execute: chatModels.refresh,
    },
    {
      when: () => {
        return !isNewThread($currentThread);
      },
      name: "Trash Current Chat",
      color: "red",
      altFilterText: "delete remove thread",
      icon: IconTrash,
      execute: async () => {
        await currentChatThread.softDeleteThread();
        currentThread.reset();
      },
    },

    {
      name: "Attempt Restore DB",
      icon: IconTerminalPrompt,
      when: () => dev && $devStore.showDebug,
      execute: async () => {
        try {
          await reinstatePriorData();
          toast({
            type: "success",
            title: "Database restored",
          });
        } catch (error) {
          toast({
            type: "error",
            title: "Error restoring database",
            message: error.message,
          });
        }
      },
    },
    {
      when: () => dev && $devStore.showDebug,
      name: "Debug - Off",
      icon: IconTerminalPrompt,
      execute: () => {
        $devStore.showDebug = false;
      },
    },
    {
      when: () => dev && !$devStore.showDebug,
      name: "Debug - On",
      icon: IconTerminalPrompt,
      execute: () => {
        $devStore.showDebug = true;
      },
    },

    {
      name: "Debug - Force Sync",
      icon: IconTerminalPrompt,
      execute: async () => {
        console.log("Resetting sync state");
        await syncStore.resetSyncState();
        const results = await syncStore.sync();
        console.log("Synced", results);
        if ((results.pulled || 0) + (results.pushed || 0)) {
          sys.alert(`Success ↑ ${results.pushed || 0},  ↓ ${results.pulled || 0}`);
        } else {
          sys.alert(`Already up to date`);
        }
      },
    },
    {
      when: () => dev && $devStore.showDebug,
      name: "Debug - Sync: Push",
      icon: IconTerminalPrompt,
      execute: () => {
        syncStore.pushChanges();
      },
    },
    {
      when: () => dev && $devStore.showDebug,
      name: "Debug - Sync: Pull",
      icon: IconTerminalPrompt,
      execute: () => {
        syncStore.pullChanges();
      },
    },

    {
      name: "Reload Window",
      execute: () => {
        window.location.reload();
      },
    },
    {
      name: "View Source Code",
      execute: () => {
        sys.openExternal("https://github.com/iansinnott/prompta");
      },
    },
    {
      keyboard: {
        shortcut: "meta+alt+i",
      },
      when: () => dev,
      name: "Devtools",
      execute: sys.toggleDevTools,
    },
    {
      when: () => dev,
      name: "Reset Current Chat",
      color: "red",
      altFilterText: "clear thread",
      execute: currentChatThread.deleteMessages,
    },
    {
      when: () => dev,
      name: "Reset Database",
      color: "red",
      execute: _clearDatabase,
    },
  ];

  function toggleMenu() {
    menuOpen = !menuOpen;
    if (menuOpen) {
      // On mobile focusing the input opens the keyboard which is not good UX
      tick().then(() => {
        !isMobile() && input.focus();
      });
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
      when: "when" in item ? item.when?.() : true,
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
      if (index === 0) {
        scrollContainer?.scrollTo(0, 0);
      } else if (index === filteredActions.length - 1) {
        scrollContainer?.scrollTo(0, scrollContainer.scrollHeight);
      } else {
        el.scrollIntoView({ block: "nearest", inline: "nearest" });
      }
    }
  }

  // Clear filter text whenever the menu opens
  $: if (menuOpen) {
    filterText = "";
  }

  // NOTE utilizing menuOpen here triggers a recompute when the menu is open
  // The UX here assumes that the menu closes after an action is executed
  $: filteredActions = menuOpen
    ? actionItems
        .filter((item) => item.when?.() ?? true)
        .filter((item) => {
          return (
            item.name.toLowerCase().includes(filterText.toLowerCase()) ||
            item.altFilterText?.toLowerCase().includes(filterText.toLowerCase())
          );
        })
    : [];
</script>

<svelte:window on:keydown={globalKeyPress} />

{#if menuOpen}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <div class="fixed inset-0 bg-transparent" on:click={toggleMenu} />
{/if}

<div class="relative text-white">
  <button
    data-testid="CommandMenuButton"
    type="button"
    on:click={toggleMenu}
    class={classNames(
      "font-bold px-2 py-2 flex items-center justify-center border border-zinc-700 rounded-lg h-[42px] w-[42px]",
      _class,
      {
        "bg-zinc-800": menuOpen,
      }
    )}
  >
    <span class="inline-flex items-center space-x-1 text-white">
      <CommandIcon
        size={20}
        class={classNames("text-sm", {
          "text-teal-300": menuOpen,
        })}
      />
    </span>
  </button>
  {#if menuOpen}
    <div
      class="absolute bottom-[calc(100%+10px)] right-0 min-w-[calc(100vw_-_30px)] sm:min-w-[425px] shadow-xl border border-zinc-700 bg-zinc-800 rounded-lg z-20 flex flex-col"
    >
      <div
        bind:this={scrollContainer}
        class={classNames("flex-1 max-h-[31svh] sm:max-h-[300px] overflow-auto py-2 px-2", {
          "scroll-visible": isMobile(), // to make it clear there are more options
        })}
      >
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
                <svelte:component this={action.icon} class="w-5 h-5" />
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
                    class={classNames(
                      "bg-white/20 inline-flex items-center justify-center rounded font-mono w-6 h-6 text-sm"
                    )}>{key}</kbd
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
  .scroll-visible::-webkit-scrollbar {
    -webkit-appearance: none;
    width: 7px;
    background-color: rgba(0, 0, 0, 0);
  }
  .scroll-visible::-webkit-scrollbar-thumb {
    border-radius: 4px;
    background-color: rgba(0, 0, 0, 0.8);
    -webkit-box-shadow: 0 0 1px rgba(255, 255, 255, 0.5);
  }
  .active {
    @apply bg-white/10;
  }
  .danger {
    @apply text-red-400;
  }
</style>
