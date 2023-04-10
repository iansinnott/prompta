<script lang="ts">
  import { thread, threadMenu } from "$lib/stores/stores";
  import classNames from "classnames";
  import { onMount, tick } from "svelte";
  import IconSparkle from "./IconSparkle.svelte";
  let _class: string = "";
  export { _class as class };
  let input: HTMLInputElement;
  let searchText = "";

  $: threadList = [
    { id: "test1", title: "Testing threads" },
    { id: "test2", title: "果冻是人民最爱的零食" },
    {
      id: "test3",
      title: "here is some much longer text that will need to be truncated to fit in the UI",
    },
  ].filter((x) => x.title.toLowerCase().includes(searchText.toLowerCase()));

  // Automatically focus the input when opened
  $: if ($threadMenu.open) {
    tick().then(() => {
      input.focus();
    });
  }
</script>

<div
  class={classNames(
    "absolute top-full w-[70vw] rounded bg-zinc-800 border border-zinc-700 p-2",
    _class
  )}
  class:hidden={!$threadMenu.open}
>
  <input
    bind:this={input}
    bind:value={searchText}
    type="text"
    class="appearance-none outline-none px-2 py-1 w-full bg-transparent text-white"
  />
  <div class="Separator h-px bg-zinc-700 my-2" />
  <button
    on:click={(e) => {
      thread.reset();
      $threadMenu.open = false;
    }}
    class="p-2 mb-1 hover:bg-white/10 rounded w-full text-left truncate flex"
  >
    <span class="relative top-[2px] left-px mr-2">
      <IconSparkle />
    </span>
    <span> New Chat </span>
  </button>
  <div class="Separator h-px bg-zinc-700 my-2" />
  {#each threadList as t (t.id)}
    {@const active = t.id === $thread.id}
    <button
      on:click={(e) => {
        $thread = t;
        $threadMenu.open = false;
      }}
      class={classNames("p-2 mb-1 hover:bg-white/10 rounded block w-full text-left truncate", {
        "bg-white/10": active,
      })}
    >
      {t.title}
    </button>
  {/each}
</div>
