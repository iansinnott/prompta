<script lang="ts">
  import classNames from "classnames";
  let _class: string = "";
  export { _class as class };
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 24 24"
  fill="none"
  class={classNames("w-6 h-6", _class)}
>
  <path
    d="M12 6V12M12 12V18M12 12H18M12 12L6 12"
    stroke="currentcolor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
</svg>
