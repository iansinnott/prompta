<script lang="ts">
  import classNames from "classnames";
  let _class: string = "";
  export { _class as class };
</script>

<div class={classNames("animate-spin rounded-full h-5 w-5 border-b-2 border-white", _class)} />
