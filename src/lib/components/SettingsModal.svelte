<script lang="ts">
  import { showSettings, db } from "$lib/stores/stores";
  import {
    gptProfileStore,
    DEFAULT_SYSTEM_MESSAGE,
    getOpenAi,
  } from "$lib/stores/stores/llmProfile";
  import { chatModels, openAiConfig } from "$lib/stores/stores/llmProvider";
  import AutosizeTextarea from "./AutosizeTextarea.svelte";
  import { getSystem } from "$lib/gui";
  import { onMount } from "svelte";
  import { ChatMessage, LLMProvider, Thread, getLatestDbName } from "$lib/db";
  import { mapKeys, toCamelCase } from "$lib/utils";
  import CloseButton from "./CloseButton.svelte";
  import { env } from "$env/dynamic/public";
  import { toast } from "$lib/toast";
  import { Circle, HelpCircle } from "lucide-svelte";
  import LlmProviderList from "./LLMProviderList.svelte";
  import { Button } from "./ui/button";

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

  let showAdvanced = false;

  $: if ($showSettings) {
    chatModels.refresh();
  }

  // Note these are not all the tables, but some tables (fragment for instance) are derived.
  const tables = ["thread", "message", "llm_provider"];

  const handleExport = async () => {
    if (!$db) {
      console.error("No database");
      throw new Error("No database");
    }

    const sys = getSystem();

    const tableData: [tableName: string, tableData: any[]][] = [];
    for (const table of tables) {
      tableData.push([table, await $db.execO(`SELECT * FROM ${table}`)]);
    }

    const version = 2;

    const data = {
      tables: tableData,
      exportDate: new Date().toISOString(),
      version,
    };

    await sys.saveAs(`${Date.now()}_prompta.v${version}.json`, JSON.stringify(data));
  };

  const handleImportV2 = async (json: any) => {
    if (!$db) {
      console.error("No database");
      throw new Error("No database");
    }

    const sys = getSystem();

    const { tables } = json;

    if (
      !(await sys.confirm(
        `Are you sure you want to import ${tables.length} tables? Although unlikely, this can cause data loss if you are importing two exports from the same database.`
      ))
    ) {
      console.log("Cancelled");
      return;
    }

    const rowCount = tables.reduce((acc, [_, tableData]) => acc + tableData.length, 0);
    let i = 0;
    let progress = i / rowCount || 1; /* avoid div by zero */

    await $db.tx(async (tx) => {
      for (const [tableName, tableData] of tables) {
        for (const row of tableData) {
          i += 1;
          progress = i / rowCount;

          console.log(`Importing ${tableName} ${i}/${rowCount} (${Math.round(progress * 100)}%)`);

          const x = mapKeys(row, (x) => {
            return toCamelCase(String(x));
          });
          if (tableName === "message") await ChatMessage.upsert(x, tx);
          else if (tableName === "thread") await Thread.upsert(x, tx);
          else if (tableName === "llm_provider") await LLMProvider.upsert(x, tx);
          else throw new Error("Unknown table");
        }
      }
    });

    console.log("%c[import/v2] success", "color:salmon;", tables.length, "tables imported");
  };
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

        <div class="text-xl mb-4 sm:col-span-2">Providers</div>

        <div class="col-span-2">
          <LlmProviderList />
        </div>

        <div class="Separator h-px bg-zinc-700 my-4" />

        <h3 class="text-xl mb-4 sm:col-span-2">LLM Settings</h3>

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
          <fieldset>
            <Button
              on:click={(e) => {
                e.preventDefault();
                handleExport();
              }}>Export All</Button
            >
            <div class="prose prose-invert prose-sm mt-2">
              <p>Export your database so you can import it again somewhere else</p>
            </div>
          </fieldset>

          <label for="import" class="label">Import:</label>
          <fieldset>
            <Button
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

                if (
                  !(await sys.confirm(
                    `Are you sure you want to import ${file.name}? Although unlikely, this can cause data loss if you are importing two exports from the same database.`
                  ))
                ) {
                  console.log("Cancelled");
                  return;
                }

                switch (json.version) {
                  case 2:
                    await handleImportV2(json);
                    break;
                  default:
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

                    console.error(
                      "Unknown file record type. Was not 'message'|'thread'",
                      file.name
                    );

                    sys.alert("Unknown file type. Could not import.");
                    break;
                }
              }}
              class=""
            >
              Import
            </Button>
            <div class="prose prose-invert prose-sm mt-2">
              <p>
                Run multiple times to import multiple prior exports. If records have the same ID,
                the later one will overwrite.
              </p>
            </div>
          </fieldset>

          <label for="c" class="label">Info:</label>
          <fieldset class="overflow-auto max-w-full">
            <pre
              class="py-1 px-2 rounded text-slate-300 text-sm border border-zinc-700 table whitespace-pre-wrap overflow-auto w-full">
           {dbName}<span class="text-blue-300 opacity-50">/{$openAiConfig.siteId}</span> 
          </pre>
            <p class="opacity-60">
              <small> Database identifier used locally for persistent storage. </small>
            </p>
          </fieldset>

          <span class="ScrollBottom" />
        {/if}
      </div>
    </form>
  </div>
{/if}

<style>
  .label {
    @apply block mb-3 sm:mb-0;
  }
  fieldset {
    @apply mb-4 border-b border-zinc-700 pb-4;
  }
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
    @apply rounded-2xl p-4 block sm:grid gap-x-4 gap-y-4 grid-cols-1 sm:grid-cols-[auto_1fr];
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
