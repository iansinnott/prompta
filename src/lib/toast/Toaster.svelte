<script lang="ts">
  import classNames from "classnames";
  let _class: string = "";
  export { _class as class };
  import { toastStore } from ".";
  import Toast from "./Toast.svelte";

  $: toasts = $toastStore.toasts;
</script>

<div class={classNames("fixed bottom-[68px] right-4 flex flex-col space-y-4 items-center", _class)}>
  {#each toasts as toast}
    <Toast
      props={toast.props}
      onClose={() => {
        toast.remove();
      }}
    />
  {/each}
</div>
