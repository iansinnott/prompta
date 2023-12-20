<script lang="ts">
  import { onMount } from "svelte";
  import classNames from "classnames";
  import { Check, ClipboardCopy } from "lucide-svelte";
  let _class: string = "";
  export { _class as class };

  export let text: string;
  export let size: string | number = 20;

  let hasCopied = false;

  $: hasChildren = !!$$slots.default;

  async function copyToClipboard() {
    if (!text) {
      console.warn("No text to copy");
      return;
    }

    return navigator.clipboard
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
    "flex items-center justify-center rounded-md space-x-1 cursor-default leading-none",
    {
      "pl-1 pr-2 ": hasChildren,
    },
    _class
  )}
>
  <span class="">
    {#if !hasCopied}
      <ClipboardCopy {size} class={classNames("text-white/40 hover:text-white")} />
    {:else}
      <Check {size} class="text-green-400" />
    {/if}
  </span>
  <span>
    <slot />
  </span>
</button>
