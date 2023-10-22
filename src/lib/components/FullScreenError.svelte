<script lang="ts">
  import classNames from "classnames";
  let _class: string = "";
  export { _class as class };
  export let error: Error;
  export let title = "An error occurred";
</script>

<div class={classNames("flex flex-col items-center justify-center h-screen p-2", _class)}>
  <div
    data-test-id="InnerError"
    class="bg-red-500/10 border border-red-500 rounded px-3 py-2 md:px-6 md:py-5 min-w-[300px] max-w-[600px] w-full overflow-auto"
  >
    <div class="text-left mb-4 pb-4 border-b border-red-200/30">
      <h1 class="text-2xl font-bold text-red-200">{title}</h1>
      <pre class="mt-2">{error.message}</pre>
    </div>
    <slot />
  </div>
</div>
