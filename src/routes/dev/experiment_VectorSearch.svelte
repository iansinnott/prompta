<script lang="ts">
  import { toast } from "svelte-sonner";
  import classNames from "classnames";
  import type { FeatureExtractionPipeline } from "@xenova/transformers";
  import { onMount } from "svelte";
  let _class: string = "";
  export { _class as class };

  import type { VecDB } from "$lib/vecDb";
  import { autosize } from "$lib/utils";
  import { Button } from "$lib/components/ui/button";
  import type { ChatMessage, FragmentRow, VecToFrag } from "$lib/db";
  import ChatMessageItem from "$lib/components/ChatMessageItem.svelte";
  import { Progress } from "$lib/components/ui/progress";
  import { goto } from "$app/navigation";
  import { vecDbStore } from "$lib/stores/stores/vecDbStore";
  import { slide } from "svelte/transition";
  import * as Card from "$lib/components/ui/card";
  import * as Tabs from "$lib/components/ui/tabs";

  const batchPartition = <T,>(xs: T[], batchSize: number): T[][] => {
    const result: T[][] = [];
    for (let i = 0; i < xs.length; i += batchSize) {
      result.push(xs.slice(i, i + batchSize));
    }
    return result;
  };

  let vecDb: VecDB;
  let content = new URLSearchParams(location.search).get("content") ?? "";

  onMount(async () => {
    // For now, this avoids circular dependency issues
    const { _get_vecDb_instance } = await import("$lib/db");

    vecDb = _get_vecDb_instance();

    const vecUpsertAll = async () => {
      // Imported lazily to avoid circular dependency
      const { Fragment, _get_db_instance } = await import("$lib/db");
      const db = _get_db_instance();
      const xs = await Fragment.findSemanticFragments();
      const data = xs.map((x) => ({
        content: x.value,
        tags: [x.role, x.threadId, "message"],
        id: x.id,
      }));

      console.time("upsertAll");
      for (const [i, batch] of batchPartition(data, 8).entries()) {
        console.time("upsertAll: " + i);
        for (const { id, ...x } of batch) {
          const result = await vecDb.upsert(x);
          if (result.inserted) {
            console.debug("inserted", x);
            await db.exec(`INSERT INTO "vec_to_frag" ("vec_id", "frag_id") VALUES(?, ?)`, [
              result.record.id,
              id,
            ]);
          }
        }
        console.timeEnd("upsertAll: " + i);
      }
      console.timeEnd("upsertAll");

      console.debug("done. upserted", data.length, "fragments");
    };

    (window as any).vecDb = vecDb;
    (window as any).vecSearch = vecDb.search;
    (window as any).vecUpsertString = vecDb.upsert;
    (window as any).vecUpsertAll = vecUpsertAll;

    if (content) {
      await handleSubmit();
    }
  });

  type VecSearchResult = Awaited<ReturnType<VecDB["search"]>>[number];

  let loading = false;
  let results: VecSearchResult[] = [];
  let messages: ChatMessage[] = [];
  let xs: Record<
    string,
    ChatMessage & { matches: { fragment: FragmentRow; similarity: number }[] }
  > = {};

  const handleSubmit = async () => {
    try {
      loading = true;
      const s = content.trim();
      goto(`?content=${encodeURIComponent(s)}`);

      if (!s) {
        toast.error("No content", {
          description: "Box cannot be empty",
        });
        return;
      }

      // Victor expects float64
      results = await vecDb.search(s, { limit: 10 });

      const messageIds = Array.from(
        new Set(
          results
            .filter((x) => x.fragment?.entity_type === "message")
            .map((x) => x.fragment!.entity_id)
        )
      );

      const { ChatMessage } = await import("$lib/db");

      messages = await ChatMessage.findMany({
        where: {
          id: {
            in: messageIds as string[],
          },
        },
      });

      xs = results
        .filter((x) => x.fragment)
        .reduce(
          (agg, x) => {
            const fragment = x.fragment!;
            const message = messages.find((y) => y.id === x.fragment!.entity_id) as ChatMessage;
            const messageId = fragment!.entity_id;
            agg[messageId] = agg[messageId] || { ...message, matches: [] };
            agg[messageId].matches.push({
              similarity: x.similarity,
              fragment,
            });
            return agg;
          },
          {} as Record<
            string,
            ChatMessage & { matches: { fragment: FragmentRow; similarity: number }[] }
          >
        );

      console.table(
        results.map((x) => ({ similarity: x.similarity.toFixed(3), content: x.content }))
      );
      console.log("search results", results);
      console.log("messages", messages);

      toast.success("Success", { description: "Model loaded" });
    } catch (error) {
      console.error(error);
      toast("Error", { description: error.message });
    } finally {
      loading = false;
    }
  };
</script>

<div class="mb-4">
  <Card.Root class="w-full">
    <Card.Header>
      <Card.Title class="m-0">Vector Search</Card.Title>
    </Card.Header>
    <Card.Content>
      <p class="mb-2">Search all messages by vector rather than FTS.</p>
      {#if $vecDbStore.loading}
        <div class="prose prose-invert">
          <table transition:slide>
            <tbody>
              <tr>
                <td>Total</td>
                <td>{$vecDbStore.total}</td>
              </tr>
              <tr>
                <td>Progress</td>
                <td>{$vecDbStore.progress}</td>
              </tr>
            </tbody>
            <Progress value={$vecDbStore.progress} max={$vecDbStore.total} />
          </table>
        </div>
      {:else if $vecDbStore.error}
        <div>{$vecDbStore.error}</div>
      {:else}
        <div>
          <Button variant="outline" class="w-full block" on:click={() => vecDbStore.ingest()}
            >Re-ingest</Button
          >
        </div>
      {/if}
    </Card.Content>
  </Card.Root>
</div>
<form action="" on:submit|preventDefault={handleSubmit}>
  <textarea
    use:autosize
    name="content"
    id="content"
    cols="30"
    rows="1"
    bind:value={content}
    on:keydown={(e) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSubmit();
      }
    }}
    class="bg-gray-700 text-white w-full p-2 rounded-lg"
  />
  <Button class="w-full block" type="submit">Search</Button>
</form>
<div class="flex flex-col space-y-3 overflow-auto mt-4">
  {#each Object.entries(xs) as [messageId, result]}
    <div class="flex space-x-2">
      <div class="relative z-10 bg-zinc-900">
        {#each result.matches as { fragment, similarity }}
          <div
            class={classNames("pt-1 px-1 font-mono ", {
              "text-green-500": similarity >= 0.6,
              "text-yellow-500": similarity >= 0.4 && similarity < 0.6,
              "text-orange-500": similarity >= 0.3 && similarity < 0.4,
              "text-red-500": similarity < 0.3,
            })}
          >
            {similarity.toString().slice(0, 5)}
          </div>
        {/each}
      </div>
      <ChatMessageItem class="flex-1" item={result} />
    </div>
  {/each}
</div>
