<script lang="ts">
  import classNames from "classnames";
  let _class: string = "";
  export { _class as class };
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  height="24"
  viewBox="0 0 24 24"
  width="24"
  class={classNames("", _class)}
>
  <path d="M0 0h24v24H0V0z" fill="none" />
  <path
    fill="currentcolor"
    d="M5 5.5C5 6.33 5.67 7 6.5 7h4v10.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V7h4c.83 0 1.5-.67 1.5-1.5S18.33 4 17.5 4h-11C5.67 4 5 4.67 5 5.5z"
  />
</svg>
