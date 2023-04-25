<script lang="ts">
  import classNames from "classnames";
  import IconClose from "./IconClose.svelte";
  let _class: string = "";
  export { _class as class };
  export let onClick: (e: MouseEvent) => any;
</script>

<button
  class={classNames("text-zinc-200 p-1 rounded hover:bg-white/10 hover:text-white", _class)}
  on:click={onClick}
>
  <IconClose />
</button>
