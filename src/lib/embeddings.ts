import { pipeline } from "@xenova/transformers";

export const createEmbedding = async (s: string) => {
  if (!s.trim()) {
    throw new Error("Cannot create embedding for empty string");
  }

  console.time("loading model");
  const extractor = await pipeline(
    "feature-extraction",
    "Xenova/all-MiniLM-L6-v2" // Not sure what works best here. Ideally would have multilingual, since gpt can speak multipel languages. Results in increased download size though
  );
  console.timeEnd("loading model");

  if (!extractor) return;

  try {
    const tensor = await extractor(s, { pooling: "mean", normalize: true });
    return {
      dims: tensor.dims,
      data: tensor.data,
      type: tensor.type,
      list: tensor.tolist().map((x) => new Float64Array(x)),
      size: tensor.size,
    };
  } catch (error) {
    console.warn("Could not create ensore for string:\n", s);
    console.error(error);
  }
};
