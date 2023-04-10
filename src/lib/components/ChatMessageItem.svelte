<script lang="ts">
  import type { ChatMessage } from "$lib/db";
  import classNames from "classnames";
  let _class: string = "";
  export { _class as class };

  export let item: ChatMessage;
</script>

<div class={classNames("", _class)}>
  {item.content}
</div>
