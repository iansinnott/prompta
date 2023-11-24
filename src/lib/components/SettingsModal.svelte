<script lang="ts">
  import {
    gptProfileStore,
    openAiConfig,
    showSettings,
    DEFAULT_SYSTEM_MESSAGE,
    db,
    getOpenAi,
    chatModels,
  } from "$lib/stores/stores";
  import AutosizeTextarea from "./AutosizeTextarea.svelte";
  import { getSystem } from "$lib/gui";
  import { onMount } from "svelte";
  import { ChatMessage, Thread, getLatestDbName } from "$lib/db";
  import { mapKeys, toCamelCase } from "$lib/utils";
  import CloseButton from "./CloseButton.svelte";
  import { env } from "$env/dynamic/public";

  const versionString = env.PUBLIC_VERSION_STRING;

  let dbName = "";
  let schema;
  let migrationVersion;
  onMount(async () => {
    schema = (await $db?.execO<{ sql: string }>(`SELECT sql FROM sqlite_master WHERE type='table'`))
      ?.map((x) => x.sql)
      ?.filter((x) => !x.includes("sqlite_") && !x.includes("crsql"));
    migrationVersion = (await $db?.execA<number[]>(`PRAGMA user_version`))?.[0];
    dbName = getLatestDbName() || "";
  });

  const updateAvailableModels = async () => {
    if ($chatModels.length) {
      console.debug("Already have models, but refetching for latest");
    }

    const openai = getOpenAi();
    const xs = await openai.models.list();
    $chatModels = xs.data
      .filter((x) => x.id.startsWith("gpt"))
      .sort((a, b) => a.id.localeCompare(b.id));
  };

  let showAdvanced = false;

  $: if ($showSettings) {
    updateAvailableModels();
  }

  $: hasCustomModel = !$chatModels.some((x) => x.id == $gptProfileStore.model);

  $: if (!$openAiConfig.baseURL) {
    $openAiConfig.baseURL = "https://api.openai.com/v1/";
  }
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
    <!-- NOTE the use of svh units. SVH units in safari do not work with calc, it seems -->
    <form
      class="bg-zinc-800 border border-zinc-700 overflow-auto flex flex-col rounded-lg absolute top-2 left-2 right-2 max-h-[96svh]"
      on:submit={(e) => e.preventDefault()}
      on:click={(e) => {
        e.stopPropagation();
      }}
    >
      <h1
        class="text-3xl mb-4 px-4 pt-4 border-b border-zinc-600 pb-4 flex-shrink-0 flex items-center justify-between"
      >
        <span> Settings </span>
        <small class="text-sm opacity-70">Prompta {versionString}</small>
        <CloseButton
          class=""
          onClick={() => {
            $showSettings = false;
          }}
        />
      </h1>
      <div class="content flex-1">
        <label class="label" for="b">Version</label>
        <div>
          Prompta {versionString}
        </div>

        <div class="Separator h-px bg-zinc-700 my-4" />

        <h3 class="text-xl mb-4 sm:col-span-2">OpenAI</h3>

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
            {#each $chatModels as model}
              <option value={model.id}>{model.id}</option>
            {/each}
          </select>
          {#if hasCustomModel}
            <p class="border border-yellow-400 mt-2 rounded bg-yellow-500/20">
              <small
                ><strong>WARNING:</strong> Using custom model. See "Advanced" settings below.</small
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

        <div class="Separator h-px bg-zinc-700 my-4" />

        <button
          class="button mb-2 border rounded border-white/30 px-2 py-1 text-xs"
          on:click={() => {
            showAdvanced = !showAdvanced;
            if (showAdvanced) {
              setTimeout(() => {
                const el = document.querySelector(".ScrollBottom");
                if (el) {
                  el.scrollIntoView({ behavior: "smooth" });
                }
              }, 100);
            }
          }}
        >
          {#if showAdvanced}
            Hide Advanced
          {:else}
            Show Advanced
          {/if}
        </button>
        {#if showAdvanced}
          <!-- separator -->

          <h3 class="text-xl mb-4 sm:col-span-2">Custom OpenAI Settings</h3>

          <label class="label" for="baseUrl"> Base URL: </label>
          <div>
            <input
              id="baseUrl"
              class="input rounded w-full"
              type="text"
              placeholder="https://api.openai.com/v1/"
              bind:value={$openAiConfig.baseURL}
            />
            <p class="leading-tight">
              <small>
                You can set a custom OpenAI base url to use Prompta with 3rd party tools such as
                helicone or local LLMs that expose OpenAI compatible APIs like <a
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
          </div>

          <label class="label" for="customModel"> Custom Model: </label>
          <div>
            <input
              id="customModel"
              class="input rounded w-full"
              type="text"
              placeholder="Enter custom model name"
              bind:value={$gptProfileStore.model}
            />
            <p class="leading-tight">
              <small>
                You can set a custom OpenAI model to use with Prompta. This will override the model
                choice above.
              </small>
            </p>
          </div>

          <h3 class="text-xl mb-4 sm:col-span-2">Database</h3>

          <label for="export" class="label">Export:</label>
          <div>
            <button
              on:click={async (e) => {
                e.preventDefault();
                if (!$db) {
                  console.error("No database");
                  throw new Error("No database");
                }
                const sys = getSystem();
                await sys.saveAs(
                  `${Date.now()}_message.json`,
                  JSON.stringify(await $db.execO(`SELECT * FROM message`))
                );
                await sys.saveAs(
                  `${Date.now()}_thread.json`,
                  JSON.stringify(await $db.execO(`SELECT * FROM thread`))
                );
                await sys.saveAs(
                  `${Date.now()}_preferences.json`,
                  JSON.stringify(await $db.execO(`SELECT * FROM preferences`))
                );
              }}
              class="flex items-center bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            >
              Export All
            </button>
            <p>
              <small>Will download multiple files.</small>
            </p>
          </div>

          <label for="import" class="label">Import:</label>
          <div>
            <button
              on:click={async (e) => {
                e.preventDefault();

                console.debug("Prepare Import");

                if (!$db) {
                  console.error("No database");
                  throw new Error("No database");
                }

                const sys = getSystem();
                const file = await sys.chooseAndOpenTextFile();

                if (!file) {
                  console.error("No file chosen");
                  return;
                }

                const json = JSON.parse(file.data);
                console.log("JSON");

                if (
                  !(await sys.confirm(
                    `Are you sure you want to import ${file.name}? Although unlikely, this can cause data loss if you are importing two exports from the same database.`
                  ))
                ) {
                  console.log("Cancelled");
                  return;
                }

                // if file.name looks like $timestamp_$table.json
                // then we can import it
                if (file.name.match(/^\d+_(message|thread)\.json$/)) {
                  console.log("%c[import/v1] legacy table export", "color:salmon;");
                  const tableName = file.name.split("_")[1].split(".")[0];

                  await $db.tx(async (tx) => {
                    for (const row of json) {
                      const x = mapKeys(row, (x) => {
                        return toCamelCase(String(x));
                      });
                      if (tableName === "message") await ChatMessage.upsert(x, tx);
                      else if (tableName === "thread") await Thread.upsert(x, tx);
                      else throw new Error("Unknown table");
                    }
                  });

                  console.log(
                    "%c[import/v1] success",
                    "color:salmon;",
                    json.length,
                    tableName,
                    "records imported"
                  );

                  return;
                }

                console.error("Unknown file record type. Was not 'message'|'thread'", file.name);

                sys.alert("Unknown file type. Could not import.");
              }}
              class="flex items-center bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            >
              Import
            </button>
            <p>
              <small
                >Run multiple times to import multiple prior exports. If records have the same ID,
                the later one will overwrite.</small
              >
            </p>
          </div>

          <label for="c" class="label">Database:</label>
          <div class="overflow-auto max-w-full">
            <pre
              class="py-1 px-2 rounded text-slate-300 text-sm border border-zinc-700 table whitespace-pre-wrap overflow-auto w-full">
           {dbName}<span class="text-blue-300 opacity-50">/{$openAiConfig.siteId}</span> 
          </pre>
            <p class="opacity-60">
              <small> Database identifier used locally for persistent storage. </small>
            </p>
          </div>

          <span class="ScrollBottom" />
        {/if}
      </div>
    </form>
  </div>
{/if}

<style>
  .Separator {
    @apply sm:col-span-2;
  }
  .backdrop {
    @apply fixed inset-0 flex items-center justify-center;
    background: rgba(0, 0, 0, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .content {
    @apply rounded-2xl p-4 gap-x-4 gap-y-4 grid-cols-1 sm:grid-cols-[auto_1fr];
    display: grid;
    /* content will have two columns, and as many rows as needed for the content */
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
