<script lang="ts">
  import classNames from "classnames";
  let _class: string = "";
  export { _class as class };
  export let text: string;
</script>

<span class={classNames("MarkdownHtmlBlock", _class)}>{text}</span>
