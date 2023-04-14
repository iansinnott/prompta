<script lang="ts">
  import { onMount, onDestroy } from "svelte";

  let interval;

  onMount(() => {
    interval = setInterval(() => {
      cursorVisible = !cursorVisible;
    }, 500);
  });

  onDestroy(() => {
    clearInterval(interval);
  });

  let cursorVisible = true;
</script>

<span class="blinking-cursor" style="opacity: {cursorVisible ? 1 : 0};" />

<style>
  .blinking-cursor {
    display: inline-block;
    background-color: #18d4f1;
    width: 3px;
    border-radius: 3px;
    height: 1.1em;
    transition: opacity 0.3s;

    /* rewrite the next line to be slightly less diffuse */
    /* box-shadow: 0 0 10px #18d4f1, 0 0 20px #18d4f1, 0 0 30px #18d4f1, 0 0 40px #18d4f1; */
    box-shadow: 0 0 8px #18d4f1, 0 0 20px #18d4f1;
  }
</style>
