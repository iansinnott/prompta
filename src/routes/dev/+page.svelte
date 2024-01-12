<script lang="ts">
  import type { importFromDatabase } from "$lib/db";

  import { toast } from "$lib/toast";
  import classNames from "classnames";
  import type { FeatureExtractionPipeline } from "@xenova/transformers";
  import { onMount } from "svelte";
  let _class: string = "";
  export { _class as class };

  let content = "";
  let extractor: FeatureExtractionPipeline | null = null;

  import { Db } from "victor-db";
  import { VecDB } from "./vecDb";

  const batchPartition = <T,>(xs: T[], batchSize: number): T[][] => {
    const result: T[][] = [];
    for (let i = 0; i < xs.length; i += batchSize) {
      result.push(xs.slice(i, i + batchSize));
    }
    return result;
  };

  onMount(async () => {
    console.debug("loading transformers");
    const { pipeline } = await import("@xenova/transformers");

    console.debug("loading model");
    extractor = await pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2" // Not sure what works best here. Ideally would have multilingual, since gpt can speak multipel languages. Results in increased download size though
    );
    console.debug("done");

    const createEmbedding = async (s: string | string[]) => {
      if (!extractor) return;

      const tensor = await extractor(s, { pooling: "mean", normalize: true });
      return {
        dims: tensor.dims,
        data: tensor.data,
        type: tensor.type,
        list: tensor.tolist().map((x) => new Float64Array(x)),
        size: tensor.size,
      };
    };

    // NOTE: This IS NECESSARY! The constructor returns a promise. Probably
    // something to do with being a Rust lib rather than a JS lib.
    // prettier-ignore
    const vecDb = new VecDB({
      embedString: async (s: string) => {
        const tensor = await createEmbedding(s);
        const x = tensor?.list[0];
        if (!x) {
          throw new Error("Could not create embedding");
        }

        return x;
      },
    });

    const vecUpsertAll = async () => {
      // Imported lazily to avoid circular dependency
      const { Fragment } = await import("$lib/db");
      const xs = await Fragment.findSemanticFragments();
      const data = xs.map((x) => ({ content: x.value, tags: [x.role, x.threadId, "message"] }));
      console.time("upsertAll");
      for (const [i, batch] of batchPartition(data, 8).entries()) {
        console.time("upsertAll: " + i);
        for (const x of batch) {
          await vecDb.upsert(x);
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
    (window as any).createEmbedding = createEmbedding;
  });

  const handleSubmit = async () => {
    if (!content.trim()) {
      toast({ title: "No content", message: "Box cannot be empty", type: "error" });
      return;
    }

    if (!extractor) {
      toast({ title: "Error", message: "Model not loaded", type: "error" });
      return;
    }

    try {
      console.log("content", content);

      const tensor = await extractor(content, { pooling: "mean", normalize: true });

      console.log("processed", { data: tensor.data, dims: tensor.dims, list: tensor.tolist() });

      // Victor expects float64
      const xs = tensor.tolist().map((x) => new Float64Array(x));
      const [_, dimension] = tensor.dims;

      console.log("dimension", dimension, "data", xs[0]);

      toast({ title: "Success", message: "Model loaded", type: "success" });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", message: error.message, type: "error" });
    }
  };
</script>

<div class={classNames("", _class)}>
  <div class="prose prose-invert">
    <h1>Dev page</h1>
    <p>A page for experimentation</p>
    <hr class="mb-5" />
  </div>

  <form action="" on:submit|preventDefault={handleSubmit}>
    <textarea
      name="content"
      id="content"
      cols="30"
      rows="3"
      bind:value={content}
      class="bg-gray-700 text-white w-full p-2"
    />
    <button class="w-full block" type="submit">Create</button>
  </form>
</div>
