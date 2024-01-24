<script lang="ts">
  import classNames from "classnames";
  let _class: string = "";
  export { _class as class };

  import { FlaskConical } from "lucide-svelte";
  import * as Tabs from "$lib/components/ui/tabs";
  import VectorSearch from "./experiment_VectorSearch.svelte";
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

  <Tabs.Root value="vector-search" class="w-full">
    <Tabs.List>
      <Tabs.Trigger value="vector-search">Vector Search</Tabs.Trigger>
      <Tabs.Trigger value="example">Example</Tabs.Trigger>
    </Tabs.List>
    <Tabs.Content value="vector-search">
      <VectorSearch />
    </Tabs.Content>
    <Tabs.Content value="example">Example stuff here</Tabs.Content>
  </Tabs.Root>
</div>
