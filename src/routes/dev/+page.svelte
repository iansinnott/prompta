<script lang="ts">
  import classNames from "classnames";
  let _class: string = "";
  export { _class as class };

  import { FlaskConical } from "lucide-svelte";
  import * as Tabs from "$lib/components/ui/tabs";
  import StatsPage from "./experimental_StatsPage.svelte";
  import ToastyPage from "./experimental_ToastyPage.svelte";

  const defaultTab = "vector-search";
  let currentTab = new URLSearchParams(location.search).get("tab") ?? defaultTab;
</script>

<div class={classNames("h-full overflow-auto", _class)}>
  <div class="prose prose-invert">
    <h1 class="flex items-center">
      <FlaskConical size="24" class="inline-block mr-4" />
      <span> Dev Experiments </span>
    </h1>
    <p>
      A page for experimentation. If you're not sure what this page is about, sorry, there are no
      instructions.
    </p>
    <p>
      This page is used for implementing very experimental features and is not meant to be used
      outside of developing Prompta.
    </p>
    <hr class="mb-5" />
  </div>

  <Tabs.Root
    value={currentTab}
    class="w-full"
    onValueChange={(x) => {
      // Update the URL search string with the new tab value
      const searchParams = new URLSearchParams(location.search);
      if (x) {
        searchParams.set("tab", x);
      } else {
        searchParams.delete("tab");
      }
      history.replaceState(null, "", "?" + searchParams.toString());
      currentTab = x || defaultTab;
    }}
  >
    <Tabs.List>
      <Tabs.Trigger value="vector-search">Vector Search</Tabs.Trigger>
      <Tabs.Trigger value="stats">Stats</Tabs.Trigger>
      <Tabs.Trigger value="toasty">Toasty</Tabs.Trigger>
    </Tabs.List>
    <Tabs.Content value="stats">
      <StatsPage />
    </Tabs.Content>
    <Tabs.Content value="toasty">
      <ToastyPage />
    </Tabs.Content>
  </Tabs.Root>
</div>
