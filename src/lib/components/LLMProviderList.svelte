<script lang="ts">
  import LlmProviderForm from "./LLMProviderForm.svelte";
  import { llmProviders } from "$lib/stores/stores/llmProvider";
  import { Button } from "./ui/button";

  $: showNewProviderButton = $llmProviders.providers.at(-1)?.id !== "new";
  $: prompta = $llmProviders.providers.find((p) => p.id === "prompta");
  $: openai = $llmProviders.providers.find((p) => p.id === "openai");
  $: anthropic = $llmProviders.providers.find((p) => p.id === "anthropic");
  $: customProviders = $llmProviders.providers.filter(
    (p) =>
      !llmProviders
        .getSpecialProviders()
        .map((x) => x.value)
        .includes(p.id)
  );
</script>

<div class="flex flex-col space-y-4">
  <!-- Prompta Section -->
  {#if prompta}
    <LlmProviderForm provider={prompta} />
  {/if}

  <!-- OpenAI Section -->
  {#if openai}
    <LlmProviderForm provider={openai} />
  {/if}

  <!-- Anthropic Section -->
  {#if anthropic}
    <LlmProviderForm provider={anthropic} />
  {/if}

  <!-- Custom Providers Section -->
  {#if customProviders.length > 0}
    {#each customProviders as provider}
      <LlmProviderForm {provider} />
    {/each}
  {/if}

  {#if showNewProviderButton}
    <Button on:click={llmProviders.addNewProvider} variant="outline" class="border border-zinc-700"
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
