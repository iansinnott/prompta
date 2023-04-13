<script lang="ts">
  import { onMount, afterUpdate } from "svelte";
  import classNames from "classnames";
  let _class: string = "";
  export { _class as class };

  let textarea: HTMLTextAreaElement;
  export let value: string = "";

  const autosize = () => {
    textarea.style.height = "auto";
    textarea.style.height = textarea.scrollHeight + "px";
  };

  onMount(autosize);
  afterUpdate(autosize);
</script>

<textarea
  bind:value
  on:input={autosize}
  class={classNames("", _class)}
  bind:this={textarea}
  {...$$restProps}
/>
