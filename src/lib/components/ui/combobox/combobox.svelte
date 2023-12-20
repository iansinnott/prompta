<script lang="ts">
  import * as Command from "$lib/components/ui/command";
  import * as Popover from "$lib/components/ui/popover";
  import { Button } from "$lib/components/ui/button";
  import { cn } from "$lib/utils";
  import { tick, type ComponentType } from "svelte";
  import IconBrain from "$lib/components/IconBrain.svelte";

  type Status = {
    value: string;
    label: string;
    icon?: ComponentType;
  };

  export let options: Status[];
  export let value = "";
  export let onChange: (value: string) => void;
  export let loading = false;

  let open = false;

  $: selectedStatus = options.find((s) => s.value === value) ?? null;

  // We want to refocus the trigger button when the user selects
  // an item from the list so users can continue navigating the
  // rest of the form with the keyboard.
  function handleChange(triggerId: string) {
    open = false;
    onChange(value);
    tick().then(() => {
      document.getElementById(triggerId)?.focus();
    });
  }
</script>

<Popover.Root bind:open let:ids>
  <Popover.Trigger asChild let:builder>
    <Button
      builders={[builder]}
      variant="outline"
      size="sm"
      class="h-[42px] justify-start border border-zinc-700"
    >
      {#if selectedStatus?.icon}
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
                value = currentValue;
                handleChange(ids.trigger);
              }}
            >
              <svelte:component
                this={opt.icon}
                class={cn(
                  "mr-2 h-4 w-4",
                  opt.value !== selectedStatus?.value && "text-foreground/40"
                )}
              />

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
