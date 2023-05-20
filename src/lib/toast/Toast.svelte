<script lang="ts">
  import classNames from "classnames";
  import type { ToastProps } from ".";
  import IconClose from "$lib/components/IconClose.svelte";
  import IconVerticalDots from "$lib/components/IconVerticalDots.svelte";
  import { fly } from "svelte/transition";
  let _class: string = "";
  export { _class as class };
  export let props: ToastProps;
  export let onClose: () => void;
</script>

<div
  transition:fly={{ y: -100, duration: 200 }}
  class={classNames(
    "Toast w-full bg-zinc-700 border border-white/10 rounded text-white shadow px-2 py-1 max-w-[320px]",
    props.type,
    _class
  )}
>
  <div
    class="{classNames({
      'row-span-2': props.message,
    })})}"
  >
    <!-- Placeholder for icon -->
    <span />
  </div>
  <div class="Toast-title flex items-center">{props.title}</div>
  <div
    class={classNames("flex", {
      "row-span-2": props.message,
    })}
  >
    <button class="Toast-close" on:click={onClose}>
      <IconClose />
    </button>
  </div>
  {#if props.message}
    <div class="Toast-message">{props.message}</div>
  {/if}
</div>

<style>
  .Toast {
    @apply gap-x-2;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    grid-template-rows:
      auto
      auto;
  }
  .Toast:global(.info) {
    @apply bg-blue-500;
  }
  .Toast:global(.success) {
    @apply bg-green-500;
  }
  .Toast:global(.error) {
    @apply bg-red-500;
  }
</style>
