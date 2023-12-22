<script lang="ts">
  import classNames from "classnames";
  import * as Command from "$lib/components/ui/command";
  import * as Popover from "$lib/components/ui/popover";
  import { Button } from "$lib/components/ui/button";
  import { cn } from "$lib/utils";
  import type { ComponentType } from "svelte";
  import IconBrain from "$lib/components/IconBrain.svelte";
  import { onMount } from "svelte";
  import { llmProviders, chatModels } from "$lib/stores/stores/llmProvider";
  import IconOpenAi from "./IconOpenAI.svelte";
  import { gptProfileStore } from "$lib/stores/stores/llmProfile";
  import { showInitScreen } from "$lib/stores/stores";
  let _class: string = "";
  export { _class as class };

  type IconSource =
    | { char: string }
    | { component: ComponentType; class?: string }
    | { src: string };

  type Status = {
    value: string;
    label: string;
    icon?: IconSource;
  };

  $: options = $chatModels.models
    .map((x) => {
      const provider = llmProviders.byId(x.provider.id);
      let icon: IconSource | undefined = undefined;

      if (provider?.id === "prompta") {
        icon = { component: IconBrain, class: "w-5 h-5" };
      } else if (provider?.id === "openai") {
        icon = { component: IconOpenAi };
      }

      return {
        value: x.id,
        label: x.id,
        icon,
      };
    })
    .concat(
      llmProviders.getOpenAi().apiKey || !llmProviders.getOpenAi().enabled // reactive
        ? []
        : [
            {
              value: "openai",
              label: "OpenAI (gpt-4, gpt-3.5, ...)",
              icon: { component: IconOpenAi },
            },
          ]
    ) as Status[];

  let value = $gptProfileStore.model || "";
  let loading = false;

  let open = false;

  $: selectedStatus = options.find((s) => s.value === value) ?? null;

  function handleChange(x: string) {
    open = false;

    if (x === "openai") {
      showInitScreen.set(true);
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
  <Popover.Root bind:open let:ids>
    <Popover.Trigger asChild let:builder>
      <Button
        builders={[builder]}
        variant="outline"
        size="sm"
        class="h-[42px] justify-start border border-zinc-700"
      >
        <!--  NOTE: Svelte is very anoyingly wrong about these TS errors. It cannot seem to discriminate types -->
        {#if selectedStatus?.icon?.src}
          <img src={selectedStatus.icon.src} class="h-4 w-4 shrink-0" alt="" />
        {:else if selectedStatus?.icon?.component}
          <svelte:component
            this={selectedStatus.icon.component}
            class={cn("h-4 w-4 shrink-0", selectedStatus.icon.class)}
          />
        {:else if selectedStatus?.icon?.char}
          <code class="text-xl inline-block">{selectedStatus.icon.char}</code>
        {:else}
          <IconBrain class="w-5 h-5 text-[#30CEC0] scale-[1.2]" />
        {/if}
      </Button>
    </Popover.Trigger>
    <Popover.Content class="w-[300px] p-0 mt-2" side="bottom" align="start">
      <Command.Root>
        <Command.Input placeholder={loading ? "Loading..." : "Model..."} />
        <Command.List>
          <Command.Empty>No results found.</Command.Empty>
          <Command.Group>
            {#each options as opt}
              <Command.Item
                value={opt.value}
                onSelect={(currentValue) => {
                  handleChange(currentValue);
                }}
              >
                {#if opt.icon?.char}
                  <code class="text-xl inline-block">{opt.icon.char}</code>
                {:else if opt.icon?.src}
                  <img
                    src={opt.icon.src}
                    class={cn(
                      "mr-2 h-4 w-4",
                      opt.value !== selectedStatus?.value && "text-foreground/40"
                    )}
                    alt=""
                  />
                {:else if opt.icon?.component}
                  <svelte:component
                    this={opt.icon.component}
                    class={cn(
                      "mr-2 h-4 w-4",
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
        </Command.List>
      </Command.Root>
    </Popover.Content>
  </Popover.Root>
</div>
