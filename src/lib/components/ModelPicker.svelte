<script lang="ts">
  import classNames from "classnames";
  import * as Command from "$lib/components/ui/command";
  import * as Popover from "$lib/components/ui/popover";
  import { Button } from "$lib/components/ui/button";
  import { cn, groupBy } from "$lib/utils";
  import type { Component as SvelteComponent } from "svelte";
  import IconBrain from "$lib/components/IconBrain.svelte";
  import { onMount } from "svelte";
  import { llmProviders, chatModels, modelPickerOpen } from "$lib/stores/stores/llmProvider";
  import IconOpenAi from "./IconOpenAI.svelte";
  import { gptProfileStore } from "$lib/stores/stores/llmProfile";
  import { showInitScreen } from "$lib/stores/stores";
  import { toast } from "$lib/toast";
  import { commandScore } from "./ui/command/command-score";
  import { Star } from "lucide-svelte";
  import { Preferences } from "$lib/db";
  import { writable } from "svelte/store";

  let _class: string = "";
  export { _class as class };

  type IconSource = { component: SvelteComponent; class?: string };

  const favoriteModels = writable<string[]>([]);

  onMount(async () => {
    // Load favorites from preferences
    const favs = (await Preferences.get("favorite_models")) || [];
    favoriteModels.set(favs);

    chatModels.refresh();
  });

  async function toggleFavorite(modelId: string, event: Event) {
    event.preventDefault();
    event.stopPropagation();

    const currentFavs = $favoriteModels;
    const newFavs = currentFavs.includes(modelId)
      ? currentFavs.filter((id) => id !== modelId)
      : [...currentFavs, modelId];

    console.debug("[ModelPicker] toggling favorite:", { modelId, currentFavs, newFavs });

    favoriteModels.set(newFavs);
    await Preferences.set("favorite_models", newFavs);
  }

  $: options = [
    ...$chatModels.models.map((x) => {
      const provider = llmProviders.byId(x.provider.id);
      let icon: IconSource | undefined = undefined;

      if (provider?.id === "prompta") {
        icon = { component: IconBrain, class: "w-5 h-5 text-[#30CEC0] " };
      } else if (provider?.id === "openai") {
        icon = { component: IconOpenAi, class: "" };
      }

      return {
        value: x.id,
        label: x.id,
        icon,
        provider,
        isFavorite: $favoriteModels.includes(x.id),
      };
    }),
    ...llmProviders.getSpecialProviders(),
  ];

  let optionGroups: Record<string, typeof options> = {};

  $: {
    const favorites = options.filter((x) => x.isFavorite);
    const nonFavorites = options.filter((x) => !x.isFavorite);
    const nonFavoriteGroups = groupBy(nonFavorites, (x) => x.provider?.name ?? "Other");

    optionGroups = favorites.length
      ? { Favorites: favorites, ...nonFavoriteGroups }
      : nonFavoriteGroups;
  }

  let value = $gptProfileStore.model || "";
  $: {
    if ($gptProfileStore.model !== value) {
      value = $gptProfileStore.model;
    }
  }

  let loading = false;

  $: selectedStatus = options.find((s) => s.value === value) ?? null;

  function handleChange(x: string) {
    $modelPickerOpen = false;

    if (x === "openai") {
      showInitScreen.set(true);
      return;
    } else if (x === "prompta") {
      llmProviders.updateProvider("prompta", {
        enabled: true,
      });
      toast({ title: "Enabling Prompta...", type: "success" });
      chatModels.refresh().then(() => {
        toast({ title: "Prompta Enabled", type: "success" });
      });
      return;
    }

    value = x;
    $gptProfileStore.model = x;
  }

  let searchValue = "";
  let selectedItem = value;

  $: filteredOptions = searchValue
    ? options.filter((opt) => {
        const score = commandScore(opt.label.toLowerCase(), searchValue.toLowerCase());
        return score > 0;
      })
    : options;

  $: filteredGroups = (() => {
    const favorites = filteredOptions.filter((x) => x.isFavorite);
    const nonFavorites = filteredOptions.filter((x) => !x.isFavorite);
    const nonFavoriteGroups = groupBy(nonFavorites, (x) => x.provider?.name ?? "Other");

    return favorites.length ? { Favorites: favorites, ...nonFavoriteGroups } : nonFavoriteGroups;
  })();

  $: {
    console.debug("[ModelPicker] favorites changed:", $favoriteModels);
  }

  function handleSearch(event: CustomEvent<string>) {
    searchValue = event.detail;
  }

  function handleKeydown(event: CustomEvent<KeyboardEvent>) {
    const e = event.detail;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      // The CommandPrimitive will handle the actual selection
    }
  }
</script>

<div class={classNames("", _class)}>
  <Popover.Root bind:open={$modelPickerOpen} let:ids>
    <Popover.Trigger asChild let:builder>
      <Button
        builders={[builder]}
        variant="outline"
        data-testid="ModelPickerButton"
        size="sm"
        class={classNames("h-[42px] justify-start border border-zinc-700 dark", {
          "bg-zinc-700": $modelPickerOpen,
        })}
      >
        <!--  NOTE: Svelte is very anoyingly wrong about these TS errors. It cannot seem to discriminate types -->
        {#if selectedStatus?.icon?.component}
          <svelte:component
            this={selectedStatus.icon.component}
            class={cn(
              "h-4 w-4 shrink-0",
              // @ts-ignore
              selectedStatus.icon.class
            )}
          />
        {:else}
          <IconBrain class="w-5 h-5 !text-[#30CEC0] scale-[1.2]" />
        {/if}
        <span class="hidden sm:inline-block ml-2">
          {selectedStatus?.label?.split("/").at(-1) ?? "Model"}
        </span>
      </Button>
    </Popover.Trigger>
    <Popover.Content
      data-testid="ModelPickerList"
      class="max-w-[500px] w-[90%] p-0 mt-2"
      side="bottom"
      align="start"
    >
      <Command.Root on:keydown={handleKeydown}>
        <Command.Input placeholder={loading ? "Loading..." : "Model..."} on:input={handleSearch} />
        <Command.List>
          <Command.Empty>No results found.</Command.Empty>
          {#each Object.entries(filteredGroups) as [name, models]}
            <Command.Group heading={name}>
              {#each models as opt}
                <Command.Item
                  value={opt.value}
                  onSelect={handleChange}
                  class="flex items-center justify-between"
                >
                  <div class="flex items-center">
                    {#if opt.icon?.component}
                      <svelte:component
                        this={opt.icon.component}
                        class={cn(
                          "mr-2 h-4 w-4",
                          // @ts-ignore
                          opt.icon.class,
                          opt.value !== selectedStatus?.value && "text-foreground/40"
                        )}
                      />
                    {/if}
                    <span>{opt.label}</span>
                  </div>

                  <!-- Only show star for actual models, not special providers -->
                  {#if opt.provider}
                    <button
                      class="flex items-center justify-center p-1 rounded-sm hover:bg-accent"
                      on:click={(e) => toggleFavorite(opt.value, e)}
                    >
                      <Star
                        class={cn(
                          "h-4 w-4",
                          opt.isFavorite
                            ? "fill-yellow-400 text-yellow-400"
                            : "text-muted-foreground"
                        )}
                      />
                    </button>
                  {/if}
                </Command.Item>
              {/each}
            </Command.Group>
          {/each}
        </Command.List>
      </Command.Root>
    </Popover.Content>
  </Popover.Root>
</div>
