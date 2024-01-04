<script lang="ts">
  import classNames from "classnames";
  let _class: string = "";
  export { _class as class };
  export let error: Error | undefined;
  export let title = "An error occurred";
  export let level: "info" | "warn" | "error" = "error";
</script>

<div class={classNames("flex flex-col items-center justify-center h-screen p-2")}>
  <div
    data-test-id="InnerError"
    class={classNames(
      "rounded px-3 py-2 md:px-6 md:py-5 min-w-[300px] max-w-[600px] w-full overflow-auto",
      {
        "bg-red-500/10 border border-red-500": level === "error",
        "bg-yellow-500/10 border border-yellow-500": level === "warn",
        "bg-blue-500/10 border border-blue-500": level === "info",
      },
      _class
    )}
  >
    <div
      class={classNames("text-left mb-4 pb-4 border-b", {
        "border-red-200/30": level === "error",
        "border-yellow-200/30": level === "warn",
        "border-blue-200/30": level === "info",
      })}
    >
      <h1
        class={classNames("text-2xl font-bold ", {
          "text-red-200": level === "error",
          "text-yellow-200": level === "warn",
          "text-blue-200": level === "info",
        })}
      >
        {title}
      </h1>
      {#if error}
        <pre class="mt-2">{error.message}</pre>
      {/if}
    </div>
    <slot />
  </div>
</div>
