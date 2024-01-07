<script lang="ts">
  import { toast } from "$lib/toast";
  import classNames from "classnames";
  import type { FeatureExtractionPipeline } from "@xenova/transformers";
  import { onMount } from "svelte";
  let _class: string = "";
  export { _class as class };

  let content = "";
  let extractor: FeatureExtractionPipeline | null = null;

  import { Db } from "victor-db";
  onMount(async () => {
    console.debug("loading transformers");
    const { pipeline } = await import("@xenova/transformers");

    console.debug("loading model");
    extractor = await pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2" // Not sure what works best here. Ideally would have multilingual, since gpt can speak multipel languages. Results in increased download size though
    );
    console.debug("done");

    // NOTE: This IS NECESSARY! The constructor returns a promise. Probably
    // something to do with being a Rust lib rather than a JS lib.
    // prettier-ignore
    const vecDb = await (new Db());

    // write to victor
    // await db.insert(content, embedding, tags);

    // read the 10 closest results from victor that are tagged with "tags"
    // (only 1 will be returned because we only inserted one embedding)
    // const result = await db.search(embedding, ["tags"], 10);
    // assert(result[0].content == content);

    // clear database
    // await db.clear();

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

    const vecSearch = async (
      q: string,
      { tags = [], limit = 10 }: { tags?: string[]; limit?: number } = {}
    ) => {
      if (!vecDb) {
        throw new Error("Could not connect to database");
      }

      console.time("createEmbedding");
      const tensor = await createEmbedding(q);
      if (!tensor) {
        throw new Error("Could not create embedding");
      }
      console.timeEnd("createEmbedding");

      const xs = tensor.list;
      console.time("search");
      const result = await vecDb.search(xs[0], tags, limit);
      console.timeEnd("search");
      return result;
    };

    const vecInsertString = async (content: string | string[], tags?: string[]) => {
      if (!vecDb) {
        throw new Error("Could not connect to database");
      }

      if (!Array.isArray(content)) {
        content = [content];
      }

      console.time("createEmbedding");
      const es = await createEmbedding(content);
      console.timeEnd("createEmbedding");

      for (const [i, c] of content.entries()) {
        const embedding = es?.list[i];
        if (!embedding) {
          console.warn("No embedding for", c);
          continue;
        }

        console.time("insert: " + c);
        await vecDb.insert(c, embedding, tags);
        console.timeEnd("insert: " + c);
      }
    };

    const vecUpsertString = async (content: string | string[], tags?: string[]) => {
      if (!vecDb) {
        throw new Error("Could not connect to database");
      }

      if (!Array.isArray(content)) {
        content = [content];
      }

      console.time("createEmbedding");
      const es = await createEmbedding(content);
      console.timeEnd("createEmbedding");

      const toInsert: [string, Float64Array][] = [];

      for (const [i, c] of content.entries()) {
        const embedding = es?.list[i];
        if (!embedding) {
          console.warn("No embedding for", c);
          continue;
        }

        const result = await vecDb.search(embedding, tags, 1);
        if (result[0]?.content === c) {
          console.log("Already exists", c);
          continue;
        }

        toInsert.push([c, embedding]);
      }

      // Run the insertion with what's left
      for (const [c, embedding] of toInsert) {
        console.time("insert: " + c);
        await vecDb.insert(c, embedding, tags);
        console.timeEnd("insert: " + c);
      }
    };

    (window as any).vecDb = vecDb;
    (window as any).vecSearch = vecSearch;
    (window as any).vecInsertString = vecInsertString;
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
