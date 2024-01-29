import { FeatureExtractionPipeline, pipeline } from "@xenova/transformers";

// Good for english. Small in size. Only english supported afaik
// ~ 25MB quantized
// const EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2";

// I got very bad results with these unfortunately in English. Ideally we do not
// want degrated english performance.
// ~ 120MB quantized
// const EMBEDDING_MODEL = "Xenova/paraphrase-multilingual-MiniLM-L12-v2";
// const EMBEDDING_MODEL = "Xenova/multilingual-e5-small";

// Results seem decent, but IMO not better than the base english model. Much,
// much slower. Would need to be put into a web worker to be viable. Embeddings
// taking a second or more. Also, cannot count on all users having a powerful
// machine.
// ~ 500mb quantized
// const EMBEDDING_MODEL = "Xenova/multilingual-e5-large";

// ~ 30MB quantized
const EMBEDDING_MODEL = "Supabase/gte-small";

let extractor: FeatureExtractionPipeline | undefined;

export const createEmbedding = async (s: string) => {
  if (!s.trim()) {
    throw new Error("Cannot create embedding for empty string");
  }

  // Load once
  if (!extractor) {
    console.time("loading model");
    extractor = await pipeline("feature-extraction", EMBEDDING_MODEL);
    console.timeEnd("loading model");
  }

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
