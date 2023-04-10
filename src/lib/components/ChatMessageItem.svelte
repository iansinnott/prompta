<script lang="ts">
  import type { ChatMessage } from "$lib/db";
  import classNames from "classnames";
  import IconUserAvatar from "./IconUserAvatar.svelte";
  let _class: string = "";
  export { _class as class };

  export let item: ChatMessage;
</script>

<div class={classNames("ChatMessage", _class)}>
  <div class="Avatar text-zinc-400 pl-2">
    {#if item.role === "user"}
      <IconUserAvatar />
    {:else}
      <img class="w-6 h-6" src="/assistant.svg" alt="" />
    {/if}
  </div>
  {item.content}
</div>

<style>
  /* ChatMessage uses a grid layout, wtih the users avatar 32px squared on the left, and a 1fr content area on the right. only one row for now */
  .ChatMessage {
    @apply gap-6;
    display: grid;
    grid-template-columns: auto 1fr;
    grid-template-areas: "profile content";
    grid-template-rows: 1fr;
  }
  .Avatar {
    grid-area: profile;
  }
</style>
