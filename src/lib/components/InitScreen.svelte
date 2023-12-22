<script lang="ts">
  import { dev } from "$app/environment";
  import { showInitScreen } from "$lib/stores/stores";
  import { gptProfileStore, verifyOpenAiApiKey } from "$lib/stores/stores/llmProfile";
  import { chatModels, llmProviders, openAiConfig } from "$lib/stores/stores/llmProvider";
  import { toast } from "$lib/toast";
  import classNames from "classnames";
  import { onMount } from "svelte";
  import { fly } from "svelte/transition";
  let _class: string = "";
  export { _class as class };

  let input: HTMLInputElement;
  let apiKey = "";
  let error = "";

  onMount(() => {
    setTimeout(() => {
      input?.focus();
    }, 500);
  });

  let loading = false;
  let buttonText = "Start Chatting";

  const handleSubmit = async () => {
    try {
      error = "";
      loading = true;
      buttonText = "Loading...";
      if (!apiKey) {
        error = "No API key provided";
        console.log("API", apiKey, input.value);
        return;
      }

      const valid = await verifyOpenAiApiKey(apiKey as string);

      if (valid) {
        llmProviders.updateProvider("openai", {
          apiKey: apiKey as string,
          enabled: true,
        });
        buttonText = "Enabling OpenAI...";
        await chatModels.refresh();
        $gptProfileStore.model = "gpt-3.5-turbo-1106"; // The cheapest openai model
        $showInitScreen = false;
      } else {
        throw new Error("Invalid API key");
      }
    } catch (err: any) {
      error = err.message;
      console.warn("Error storing api key", err);
      toast({
        title: "Could not verify your API key",
        message: err.message,
        type: "error",
      });
    } finally {
      loading = false;
      buttonText = "Start Chatting";
    }
  };

  const skipInitScreen = () => {
    $showInitScreen = false;
  };
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<div
  class={classNames(
    "InitScreen bg-gradient-to-b from-[#1B1B1B] to-transparent flex flex-col items-center p-12 pt-20",
    _class
  )}
>
  <div
    in:fly|global={{ duration: 500, delay: 150, y: -100, opacity: 0 }}
    out:fly|global={{ duration: 500, y: 30, opacity: 0 }}
  >
    <img src="icon_256x256.png" alt="Prompta Icon" class="w-32 h-32" />
  </div>
  <h1
    in:fly|global={{ duration: 300, delay: 200, y: 50, opacity: 0 }}
    out:fly|global={{ duration: 300, delay: 0, y: 50, opacity: 0 }}
    class="text-transparent bg-clip-text bg-gradient-to-br via-sky-400 to-indigo-500 from-blue-100 text-3xl font-extrabold tracking-wider"
  >
    OpenAI Setup
  </h1>
  <form
    on:submit|preventDefault={handleSubmit}
    in:fly|global={{ duration: 300, delay: 200, y: 50, opacity: 0 }}
    out:fly|global={{ duration: 300, delay: 0, y: 50, opacity: 0 }}
    class="mt-8 max-w-[400px] flex flex-col space-y-4"
  >
    <label for="sk"> To use OpenAI, enter an API key: </label>
    <div
      class={classNames("rounded p-px gradient-border", {
        error: error,
        "gradient-animate-once": !loading,
        "gradient-animate-infinite": loading,
      })}
    >
      <input
        id="sk"
        class="input rounded w-full focus:ring-0 focus:outline-none"
        type="password"
        placeholder="sk-abc..."
        data-testid="APIKeyInput"
        bind:value={apiKey}
        bind:this={input}
      />
    </div>
    <button
      type="submit"
      data-testid="SaveAPIKeyButton"
      class="w-full text-center px-2 py-[6px] rounded bg-gradient-to-r to-indigo-800 from-blue-500 text-white font-semibold tracking-wide"
    >
      {buttonText}
    </button>
    <p class="leading-light">
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
    <p class="leading-tight">
      <small>
        Your API key is stored locally on your computer. It is not sent to any server. If you ever
        wish to remove it from local storage simply delete it from the settings screen.
      </small>
    </p>
    <button
      type="button"
      data-testid="SkipAPIKeyButton"
      class="w-full text-center px-2 py-[6px] rounded text-white font-semibold tracking-wide border border-white/30 hover:bg-white/10"
      on:click={skipInitScreen}
    >
      Cancel
    </button>
  </form>
</div>

<style>
  .gradient-border {
    position: relative;
  }

  .gradient-border:before {
    content: "";
    position: absolute;
    pointer-events: none;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    border: 2px solid transparent;
    background-image: linear-gradient(45deg, #13e6dd, #5e5eb5, #13e6dd);
    background-size: 200% 200%;
    z-index: 0;
    border-radius: inherit;
  }

  .gradient-border.error:before {
    @apply bg-gradient-to-br from-red-500 to-yellow-500;
  }

  .gradient-animate-once:before {
    animation: gradient 1s linear;
    animation-delay: 500ms;
  }
  .gradient-animate-infinite:before {
    animation: gradient 1s linear infinite;
  }

  .gradient-border:after {
    content: "";
    position: absolute;
    z-index: 1;
    top: 3px;
    right: 3px;
    bottom: 3px;
    left: 3px;
    border-radius: inherit;
  }

  .gradient-border > * {
    position: relative;
    z-index: 2;
  }

  @keyframes gradient {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: 0 200%;
    }
  }
</style>
