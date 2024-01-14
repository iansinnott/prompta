<script lang="ts">
  import { toast } from "$lib/toast";
  import classNames from "classnames";
  import type { FeatureExtractionPipeline } from "@xenova/transformers";
  import { onMount } from "svelte";
  let _class: string = "";
  export { _class as class };

  import type { VecDB } from "$lib/vecDb";
  import { Atom } from "lucide-svelte";
  import { autosize } from "$lib/utils";
  import { Button } from "$lib/components/ui/button";
  import type { ChatMessage, FragmentRow, VecToFrag } from "$lib/db";
  import ChatMessageItem from "$lib/components/ChatMessageItem.svelte";
  import { goto } from "$app/navigation";

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
        toast({ title: "No content", message: "Box cannot be empty", type: "error" });
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

      toast({ title: "Success", message: "Model loaded", type: "success" });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", message: error.message, type: "error" });
    } finally {
      loading = false;
    }
  };
</script>

<div class={classNames("h-full overflow-auto", _class)}>
  <div class="prose prose-invert">
    <h1 class="flex items-center">
      <Atom size="24" class="inline-block mr-4" />
      <span> Dev Experiments </span>
    </h1>
    <p>
      A page for experimentation. If you're not sure what this page is about, sorry, there are no
      instructions.
    </p>
    <p>
      This page is used for implementing very experimental features and is not meant to be used
      outside of developing Prompta.
    </p>
    <hr class="mb-5" />
  </div>

  <div class="prose prose-invert mb-4">
    <h3>Vector Search</h3>
    <p>Search all messages by vector rather than FTS.</p>
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
</div>
