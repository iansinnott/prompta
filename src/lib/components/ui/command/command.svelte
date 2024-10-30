<script lang="ts">
  import { Command as CommandPrimitive } from "cmdk-sv";
  import { cn } from "$lib/utils";
  import { createEventDispatcher } from "svelte";

  type $$Props = CommandPrimitive.CommandProps;

  let className: string | undefined | null = undefined;
  export { className as class };
  export let value: string = "";

  const dispatch = createEventDispatcher();

  function handleKeydown(event: CustomEvent<KeyboardEvent>) {
    dispatch("keydown", event.detail);
  }
</script>

<CommandPrimitive.Root
  class={cn(
    "flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground",
    className
  )}
  bind:value
  {...$$restProps}
  on:keydown={handleKeydown}
>
  <slot />
</CommandPrimitive.Root>
