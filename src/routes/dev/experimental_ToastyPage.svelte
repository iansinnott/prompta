<script lang="ts">
  import classNames from "classnames";
  let _class: string = "";
  export { _class as class };
  import { toast } from "svelte-sonner";
  import { Button } from "$lib/components/ui/button";
</script>

<div class={classNames("", _class)}>
  <div class="prose prose-invert">
    <p>Test your toasts.</p>
  </div>
  <Button
    on:click={() => {
      toast("Hello world!");
    }}
  >
    Toast
  </Button>
</div>
