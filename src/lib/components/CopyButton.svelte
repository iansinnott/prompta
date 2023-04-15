<script lang="ts">
  import { onMount } from "svelte";
  import IconCheckMark from "./IconCheckMark.svelte";
  import IconCopyClipboard from "./IconCopyClipboard.svelte";

  export let text: string;

  let hasCopied = false;

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
  class="w-8 h-8 flex items-center justify-center rounded-md border border-white/10 cursor-default"
>
  {#if !hasCopied}
    <IconCopyClipboard class="text-white/40 scale-90" />
  {:else}
    <IconCheckMark class="text-green-400 scale-90" />
  {/if}
</button>
