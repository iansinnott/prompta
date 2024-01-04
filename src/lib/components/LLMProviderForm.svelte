<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import * as Card from "$lib/components/ui/card";
  import { Input } from "$lib/components/ui/input";
  import { Switch } from "$lib/components/ui/switch";
  import { chatModels, isDefaultProvider, llmProviders } from "$lib/stores/stores/llmProvider";
  import classNames from "classnames";
  import IconBrain from "./IconBrain.svelte";
  import { slide } from "svelte/transition";
  import type { LLMProvider } from "$lib/db";
  import { nanoid } from "nanoid";
  import { toast } from "$lib/toast";
  import { Trash } from "lucide-svelte";
  import IconOpenAi from "./IconOpenAI.svelte";
  import { verifyOpenAICompatibileProvider } from "$lib/stores/stores/llmProfile";
  import SmallSpinner from "./SmallSpinner.svelte";
  let _class: string = "";
  export { _class as class };

  export let provider: LLMProvider;

  const descriptions = {
    prompta:
      "Home-grown Prompta AI! Free until the cost becomes prohibitive. Use this if you don't want to bring your own API key.",
    openai: "The most accurate LLMs thus far. Use this if you want to use your own OpenAI API key.",
  };

  // NOTE: Don't extract `enabled` from the provider object, it causes a bug where the switch doesn't update
  let { name, baseUrl, apiKey } = provider;

  const cancelEdit = () => {
    name = provider.name;
    baseUrl = provider.baseUrl;
    apiKey = provider.apiKey;

    if (isNewProvider(provider)) {
      llmProviders.removeProvider("new");
    }
  };

  const isNewProvider = (x: LLMProvider) => x.id === "new";

  let loading = false;

  $: isDirty =
    isNewProvider(provider) ||
    name !== provider.name ||
    baseUrl !== provider.baseUrl ||
    apiKey !== provider.apiKey;
</script>

<Card.Root class={classNames("", _class)}>
  <Card.Header>
    <Card.Title class="flex items-center space-x-4">
      {#if provider.id === "prompta"}
        <IconBrain class="w-6 h-6 text-[#30CEC0] scale-[1.2]" />
      {:else if provider.id === "openai"}
        <IconOpenAi class="w-6 h-6 " />
      {/if}
      <span>
        {provider.name}
      </span>
      {#if !isDefaultProvider(provider) && !isNewProvider(provider)}
        <button
          class="hover:text-red-500"
          on:click={() => {
            llmProviders.removeProvider(provider.id);
          }}
        >
          <Trash class="w-5 h-5" />
        </button>
      {/if}
      {#if !isNewProvider(provider)}
        <Switch
          class="!ml-auto"
          disabled={provider.id === "openai" && !provider.apiKey}
          checked={provider.id === "openai"
            ? Boolean(provider.apiKey && provider.enabled)
            : provider.enabled}
          onCheckedChange={async (checked) => {
            if (provider.id === "openai" && !provider.apiKey) {
              toast({
                title: "API Key required",
                message: "Please enter an API key to enable.",
                type: "error",
              });
              return;
            }

            await llmProviders.updateProvider(provider.id, { enabled: checked });
            await chatModels.refresh();
            toast({
              title: "Provider updated",
              message: `${provider.name} ${checked ? "enabled" : "disabled"}`,
              type: "success",
            });
          }}
        />
      {/if}
    </Card.Title>
    {#if descriptions[provider.id]}
      <Card.Description>{descriptions[provider.id]}</Card.Description>
    {/if}
  </Card.Header>
  {#if provider.id !== "prompta"}
    <Card.Content>
      <form>
        <div class="grid w-full items-center gap-4">
          {#if provider.id !== "openai"}
            <div class="flex flex-col space-y-1.5">
              <Input bind:value={name} placeholder="Name of the provider" />
            </div>
            <div class="flex flex-col space-y-1.5">
              <Input bind:value={baseUrl} placeholder="Base URL (ex: https://api.openai.com/v1/)" />
            </div>
          {/if}

          <div class="flex flex-col space-y-1.5">
            <Input bind:value={apiKey} placeholder="API Key (Optional)" type="password" />
          </div>

          {#if provider.id === "openai"}
            <p class="leading-tight">
              <small> You can find or regenerate your API key in the OpenAI dashboard. </small>
              <small>
                See:
                <a
                  class="text-blue-200 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                  href="https://platform.openai.com/account/api-keys"
                >
                  https://platform.openai.com/account/api-keys
                </a>
              </small>
            </p>
          {/if}

          <p class="leading-tight">
            <small>
              Your API key is stored locally on your computer. If you ever wish to remove it from
              local storage simply delete the value above.
            </small>
          </p>
        </div>
      </form>
    </Card.Content>
    {#if isDirty}
      <div transition:slide={{ duration: 150 }}>
        <Card.Footer class="flex justify-between">
          <Button on:click={cancelEdit} variant="outline">Cancel</Button>
          <Button
            on:click={async () => {
              if (!name) {
                toast({
                  title: "Name is required",
                  message: "Please enter a name.",
                  type: "error",
                });
                return;
              }
              if (!baseUrl) {
                toast({
                  title: "Base URL is required",
                  message: "Please enter a base URL.",
                  type: "error",
                });
                return;
              }
              try {
                new URL(baseUrl);
              } catch (e) {
                toast({
                  title: "Invalid URL",
                  message: "Please enter a valid URL.",
                  type: "error",
                });
                return;
              }

              if (!baseUrl.endsWith("/")) {
                baseUrl += "/"; // Should probably handle this at the calling code, but the trailing slash is required
              }

              if (provider.id !== "openai") {
                try {
                  loading = true;
                  const isCompatible = await verifyOpenAICompatibileProvider({
                    baseUrl,
                    apiKey,
                  });
                  if (!isCompatible) {
                    toast({
                      title: "Incompatible API",
                      message:
                        "The provided API key is not compatible with the selected provider. Prompta requires ",
                      type: "error",
                    });
                    return;
                  }
                } catch (e) {
                  toast({
                    title: "Error",
                    message: e.message,
                    type: "error",
                  });
                  return;
                }
              }

              if (isNewProvider(provider)) {
                await llmProviders.createProvider({
                  id: nanoid(),
                  name,
                  baseUrl,
                  apiKey,
                  enabled: true,
                });
                loading = false;
              } else {
                await llmProviders.updateProvider(provider.id, {
                  name,
                  baseUrl,
                  apiKey,
                });
              }

              chatModels.refresh();
            }}
          >
            {#if loading}
              <SmallSpinner class="w-5 h-5 mr-2 border-black" />
            {:else}
              Save
            {/if}
          </Button>
        </Card.Footer>
      </div>
    {/if}
  {/if}
</Card.Root>
