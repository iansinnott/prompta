import { Db } from "victor-db";

interface Opts {
  embedString: (str: string) => Promise<Float64Array>;
}

interface VictorDBRecord {
  similarity: number;
  embedding: VictorEmbedding;
  content: string;
}

interface VictorEmbedding {
  id: string;
  vector: VictorVector;
}

interface VictorVector {
  data: number[];
  min: number;
  max: number;
}

export class VecDB {
  db: Db | null = null;

  /**
   * Given a string, return a vector embedding of it. The VecDB class is
   * agnostic to how this is done.
   */
  embedString: (str: string) => Promise<Float64Array>;

  constructor(opts: Opts) {
    this.embedString = opts.embedString;

    this.init();
  }

  async init() {
    // NOTE: This IS NECESSARY! The constructor returns a promise. Probably
    // something to do with being a Rust lib rather than a JS lib.
    this.db = await new Db();
  }

  isReady(): this is { db: Db } {
    return this.db !== null;
  }

  async searchEmbedding(
    embedding: Float64Array,
    { tags = [], limit = 10 }: { tags?: string[]; limit?: number } = {}
  ) {
    if (!this.isReady()) {
      throw new Error("DB not ready");
    }

    console.time("search");
    const result = await this.db.search(embedding, tags, limit);
    console.timeEnd("search");

    return result as VictorDBRecord[];
  }

  search = async (
    q: string,
    { tags = [], limit = 10 }: { tags?: string[]; limit?: number } = {}
  ) => {
    if (!this.isReady()) {
      throw new Error("DB not ready");
    }

    console.time("embedString");
    const embedding = await this.embedString(q);
    console.timeEnd("embedString");

    return this.searchEmbedding(embedding, { tags, limit });
  };

  upsert = async (record: { content: string; tags?: string[] }) => {
    if (!this.isReady()) {
      throw new Error("Could not connect to database");
    }

    console.time("embedString");
    const embedding = await this.embedString(record.content);
    console.timeEnd("embedString");

    const result = await this.searchEmbedding(embedding, {
      tags: record.tags,
      limit: 1,
    });

    if (result[0]?.content === record.content) {
      console.log("Already exists", record);
      return result[0].embedding;
    }

    console.time("insert");
    await this.db.insert(record.content, embedding, record.tags);
    console.timeEnd("insert");

    // Return the new record
    const xs = await this.searchEmbedding(embedding, {
      tags: record.tags,
      limit: 1,
    });

    return xs[0].embedding;
  };
}
