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
    <p class="leading-tight">
      <small>
        You can use Prompta with any 3rd party tools that support the OpenAI API such as Helicone or
        local LLMs that expose OpenAI compatible APIs like <a
          href="https://github.com/mudler/LocalAI"
          class="text-blue-200 hover:underline"
          target="_blank"
          rel="noopener noreferrer">LocalAI</a
        >
        or
        <a
          href="https://github.com/BerriAI/litellm"
          class="text-blue-200 hover:underline"
          target="_blank"
          rel="noopener noreferrer">LiteLLM</a
        >.
      </small>
    </p>
  {/if}
</div>
