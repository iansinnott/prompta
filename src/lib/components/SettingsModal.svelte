<script lang="ts">
  import {
    gptProfileStore,
    openAiConfig,
    showSettings,
    DEFAULT_SYSTEM_MESSAGE,
    db,
  } from "$lib/stores/stores";
  import { DB_NAME } from "$lib/constants";
  import AutosizeTextarea from "./AutosizeTextarea.svelte";
  import { getSystem } from "$lib/gui";
  import { onMount } from "svelte";
  import { ChatMessage, Thread } from "$lib/db";
  import { mapKeys, toCamelCase } from "$lib/utils";
  import CloseButton from "./CloseButton.svelte";

  let schema;
  let migrationVersion;
  onMount(async () => {
    schema = (await $db?.execO<{ sql: string }>(`SELECT sql FROM sqlite_master WHERE type='table'`))
      ?.map((x) => x.sql)
      ?.filter((x) => !x.includes("sqlite_") && !x.includes("crsql"));
    migrationVersion = (await $db?.execA<number[]>(`PRAGMA user_version`))?.[0];
  });
  let showAdvanced = false;
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
        <CloseButton
          class=""
          onClick={() => {
            $showSettings = false;
          }}
        />
      </h1>
      <div class="content flex-1">
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
                  console.log("Canclled");
                  return;
                }

                // if file.name looks like $timestamp_$table.json
                // then we can import it
                if (file.name.match(/^\d+_(message|thread)\.json$/)) {
                  console.log("%c[import/v1] legacy table export", "color:salmon;");
                  const tableName = file.name.split("_")[1].split(".")[0];

                  for (const row of json) {
                    const x = mapKeys(row, (x) => {
                      return toCamelCase(String(x));
                    });
                    if (tableName === "message") await ChatMessage.upsert(x);
                    else if (tableName === "thread") await Thread.upsert(x);
                    else throw new Error("Unknown table");
                  }

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
           {DB_NAME}<span class="text-blue-300 opacity-50">/{$openAiConfig.siteId}</span> 
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
