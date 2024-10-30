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
  let _class: string = "";
  export { _class as class };

  type IconSource = { component: SvelteComponent; class?: string };

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
      };
    }),
    ...llmProviders.getSpecialProviders(),
  ];
  $: optionGroups = groupBy(options, (x) => x.provider?.name ?? "Other");

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

  onMount(() => {
    chatModels.refresh();
  });
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
      <Command.Root>
        <Command.Input placeholder={loading ? "Loading..." : "Model..."} />
        <Command.List>
          <Command.Empty>No results found.</Command.Empty>
          {#each Object.entries(optionGroups) as [name, models]}
            <Command.Group heading={name}>
              {#each models as opt}
                <Command.Item
                  value={opt.value}
                  onSelect={(currentValue) => {
                    handleChange(currentValue);
                  }}
                >
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

                  <span>
                    {opt.label}
                  </span>
                </Command.Item>
              {/each}
            </Command.Group>
          {/each}
        </Command.List>
      </Command.Root>
    </Popover.Content>
  </Popover.Root>
</div>
