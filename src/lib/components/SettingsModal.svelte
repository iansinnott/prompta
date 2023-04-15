<script lang="ts">
  import {
    gptProfileStore,
    openAiConfig,
    showSettings,
    profilesStore,
    DEFAULT_SYSTEM_MESSAGE,
  } from "$lib/stores/stores";
  import { DB_NAME } from "$lib/constants";
  import AutosizeTextarea from "./AutosizeTextarea.svelte";
  import IconRefresh from "./IconRefresh.svelte";
</script>

<!-- Hide on escape -->
<svelte:window
  on:keydown={(e) => {
    if (e.key === "Escape" && $showSettings) {
      $showSettings = false;
    }
  }}
/>

{#if $showSettings}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <div class="backdrop z-20" on:click={() => ($showSettings = false)}>
    <form
      on:submit={(e) => e.preventDefault()}
      on:click={(e) => {
        e.stopPropagation();
      }}
      class="bg-zinc-800 w-[calc(100%-80px)] max-h-[90vh] border border-zinc-700 overflow-auto flex flex-col rounded-lg"
    >
      <h1 class="text-3xl mb-4 px-4 pt-4 border-b border-zinc-600 pb-4 flex-shrink-0">Settings</h1>
      <div class="content flex-1">
        <h3 class="text-xl mb-4 col-span-2">OpenAI</h3>

        <label class="label" for="b"> API Key: </label>
        <div class:warning={!$openAiConfig.apiKey}>
          <input
            id="b"
            class="input rounded w-full"
            type="password"
            placeholder="sk-abc..."
            bind:value={$openAiConfig.apiKey}
          />
          <p class="leading-tight">
            <small>
              A valid API is required for the app to work. You can find or regenerate your API key
              in the OpenAI dashboard.
            </small>
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
              Your API key is stored locally on your computer. It is not sent to any server. If you
              ever wish to remove it from local storage simply delete the value above.
            </small>
          </p>
        </div>

        <label for="a" class="label"> Model: </label>
        <div class:info={$gptProfileStore.model === "gpt-4"}>
          <select id="a" class="input rounded w-full" bind:value={$gptProfileStore.model}>
            <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
            <option value="gpt-4">gpt-4</option>
          </select>
          {#if $gptProfileStore.model === "gpt-4"}
            <p>
              <small
                >Warning: gpt-4 may require an invite. If chat doesn't work make sure your account
                has an invite by checking your email.</small
              >
            </p>
          {/if}
        </div>

        <label for="d" class="label">System Message:</label>
        <div>
          <AutosizeTextarea
            id="d"
            class="input rounded w-full text-xs"
            placeholder="You are a helpful assistant."
            bind:value={$gptProfileStore.systemMessage}
          />
          {#if $gptProfileStore.name === "default" && $gptProfileStore.systemMessage !== DEFAULT_SYSTEM_MESSAGE}
            <p class="text-xs">
              <button
                on:click={(e) => {
                  $gptProfileStore.systemMessage = DEFAULT_SYSTEM_MESSAGE;
                }}
                class="text-blue-300 underline"
              >
                Reset
              </button> to default
            </p>
          {/if}
          <p>
            <small> The system message affects how the model responds. </small>
          </p>
        </div>

        <!-- separator -->
        <div class="Separator h-px bg-zinc-700 my-4" />
        <h3 class="text-xl mb-4 col-span-2">Chat History Sync</h3>
        <p class="col-span-2 -mt-6 opacity-80">
          <small
            >(todo) Syncing, replication and backup of your stored chats is not yet supported.</small
          >
        </p>

        <label for="c" class="label">Replication Service Host:</label>
        <input
          disabled={true}
          id="c"
          class="input opacity-60"
          type="text"
          placeholder="Ex: http://localhost:8080"
          bind:value={$openAiConfig.replicationHost}
        />

        <label for="c" class="label">Database:</label>
        <div>
          <pre class="py-1 px-2 rounded text-slate-300 border border-zinc-700 table">{DB_NAME}</pre>
          <p class="opacity-60">
            <small> Database identifier used locally for persistent storage. </small>
          </p>
        </div>
      </div>
    </form>
  </div>
{/if}

<style>
  .Separator {
    @apply col-span-2;
  }
  .backdrop {
    @apply fixed inset-0 flex items-center justify-center;
    background: rgba(0, 0, 0, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .content {
    @apply rounded-2xl p-4 gap-x-4 gap-y-4;
    display: grid;
    /* content will have two columns, and as many rows as needed for the content */
    grid-template-columns: auto 1fr;
    grid-template-rows: minmax(0, 1fr);
    align-items: start;
  }
  select {
    @apply text-white bg-zinc-700 border border-zinc-500;
    color: #ffffff;
    appearance: none;
  }
  .warning {
    @apply border border-yellow-500 bg-yellow-800 rounded;
  }
  .warning p {
    @apply text-yellow-200;
  }
  .info {
    @apply border border-teal-500/30 bg-teal-800/30 rounded;
  }
  .info p {
    @apply text-teal-200;
  }
  input + p,
  select + p,
  input + p + p {
    @apply px-2 py-1 leading-tight;
  }
</style>
