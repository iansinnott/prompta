<script lang="ts">
  import { toast } from "$lib/toast";
  import classNames from "classnames";
  import type { FeatureExtractionPipeline } from "@xenova/transformers";
  let _class: string = "";
  export { _class as class };

  let content = "";

  const handleSubmit = async () => {
    if (!content.trim()) {
      toast({ title: "No content", message: "Box cannot be empty", type: "error" });
      return;
    }

    try {
      console.log("loading model");
      const { pipeline } = await import("@xenova/transformers");

      const extractor: FeatureExtractionPipeline = await pipeline(
        "feature-extraction",
        "Xenova/all-MiniLM-L6-v2" // Not sure what works best here. Ideally would have multilingual, since gpt can speak multipel languages. Results in increased download size though
      );

      console.log("content", content);

      const tensor = await extractor(content, { pooling: "mean", normalize: true });

      console.log("processed", { data: tensor.data, dims: tensor.dims, list: tensor.tolist() });

      // Victor expects float64
      const data = new Float64Array(tensor.data);
      const [_, dimension] = tensor.dims;

      console.log("dimension", dimension, "data", data);

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
