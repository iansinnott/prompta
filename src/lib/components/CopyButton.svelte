<script lang="ts">
  import { onMount } from "svelte";
  import IconCheckMark from "./IconCheckMark.svelte";
  import IconCopyClipboard from "./IconCopyClipboard.svelte";
  import classNames from "classnames";
  let _class: string = "";
  export { _class as class };

  export let text: string;

  let hasCopied = false;

  $: hasChildren = !!$$slots.default;

  async function copyToClipboard() {
    if (!text) {
      console.warn("No text to copy");
      return;
    }

    navigator.clipboard
      .writeText(text)
      .then((x) => {
        hasCopied = true;
        setTimeout(() => {
          hasCopied = false;
        }, 1000);
      })
      .catch((err) => {
        console.error("Failed to copy: ", err);
      });
  }
</script>

<button
  on:click={copyToClipboard}
  class={classNames(
    "flex items-center justify-center rounded-md border border-white/10 cursor-default leading-none",
    {
      "pl-1 pr-2 ": hasChildren,
    },
    _class
  )}
>
  <span class="">
    {#if !hasCopied}
      <IconCopyClipboard class="text-white/40 scale-90" />
    {:else}
      <IconCheckMark class="text-green-400 scale-90" />
    {/if}
  </span>
  <slot />
</button>
