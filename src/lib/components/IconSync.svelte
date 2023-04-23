<script lang="ts">
  import classNames from "classnames";
  let _class: string = "";
  export { _class as class };
  export let innerClass: string = "";
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  xmlns:xlink="http://www.w3.org/1999/xlink"
  version="1.1"
  x="0px"
  y="0px"
  viewBox="0 0 24 24"
  enable-background="new 0 0 24 24"
  xml:space="preserve"
  class={classNames("w-6 h-6", _class)}
>
  <g id="Frames-24px">
    <rect fill="none" width="24" height="24" />
  </g>
  <g id="Outline">
    <g>
      <path
        fill="currentcolor"
        d="M6.351,6.351C7.824,4.871,9.828,4,12,4c4.411,0,8,3.589,8,8h2c0-5.514-4.486-10-10-10    C9.285,2,6.78,3.089,4.938,4.938L3,3v6h6L6.351,6.351z"
      />
      <path
        fill="currentcolor"
        d="M17.649,17.65C16.176,19.129,14.173,20,12,20c-4.411,0-8-3.589-8-8H2c0,5.515,4.486,10,10,10    c2.716,0,5.221-1.089,7.062-2.938L21,21v-6h-6L17.649,17.65z"
      />
      <g class={innerClass}>
        <circle fill="currentcolor" cx="12" cy="12" r="2" />
      </g>
    </g>
  </g>
</svg>
