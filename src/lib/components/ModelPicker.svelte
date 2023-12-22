<script lang="ts">
  import classNames from "classnames";
  import * as Command from "$lib/components/ui/command";
  import * as Popover from "$lib/components/ui/popover";
  import { Button } from "$lib/components/ui/button";
  import { cn } from "$lib/utils";
  import type { ComponentType } from "svelte";
  import IconBrain from "$lib/components/IconBrain.svelte";
  import { gptProfileStore } from "$lib/stores/stores";
  import { onMount } from "svelte";
  import { llmProviders, chatModels } from "$lib/stores/stores/llmProvider";
  import IconOpenAi from "./IconOpenAI.svelte";
  let _class: string = "";
  export { _class as class };

  type Status = {
    value: string;
    label: string;
    icon?: ComponentType;
  };

  $: options = $chatModels.models.map((x) => {
    const provider = llmProviders.byId(x.provider.id);
    return {
      value: x.id,
      label: x.id,
      icon: provider?.id === "prompta" ? IconBrain : provider?.id === "openai" ? IconOpenAi : null,
    };
  }) as Status[];

  let value = "";
  let loading = false;

  let open = false;

  $: selectedStatus = options.find((s) => s.value === value) ?? null;

  function handleChange(x: string) {
    open = false;
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
        {#if typeof selectedStatus?.icon === "string"}
          <img src={selectedStatus?.icon} class="h-4 w-4 shrink-0" alt="" />
        {:else if selectedStatus?.icon}
          <svelte:component this={selectedStatus.icon} class="h-4 w-4 shrink-0" />
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
                {#if typeof opt.icon === "string"}
                  <img
                    src={opt.icon}
                    class={cn(
                      "mr-2 h-4 w-4",
                      opt.value !== selectedStatus?.value && "text-foreground/40"
                    )}
                    alt=""
                  />
                {:else}
                  <svelte:component
                    this={opt.icon}
                    class={cn(
                      "mr-2 h-4 w-4 ",
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
