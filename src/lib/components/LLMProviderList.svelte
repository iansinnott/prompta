<script lang="ts">
  import classNames from "classnames";
  import LlmProviderForm from "./LLMProviderForm.svelte";
  import { llmProviders } from "$lib/stores/stores/llmProvider";
  import { Button } from "./ui/button";
  let _class: string = "";
  export { _class as class };

  const handleNewProvider = () => {
    llmProviders.addProvider({
      id: "new",
      name: "New Provider",
      baseUrl: "",
      apiKey: "",
      enabled: false,
      createdAt: new Date(),
    });
  };

  $: showNewProviderButton = $llmProviders.providers.at(-1)?.id !== "new";
</script>

<div class="flex flex-col space-y-4">
  {#each $llmProviders.providers as provider}
    <LlmProviderForm {provider} />
  {/each}

  {#if showNewProviderButton}
    <Button on:click={handleNewProvider} variant="outline" class="border border-zinc-700"
      >Add custom LLM provider</Button
    >
  {/if}
</div>
