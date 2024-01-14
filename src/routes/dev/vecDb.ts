import type { FragmentRow } from "$lib/db";
import type { DBAsync } from "@vlcn.io/xplat-api";
import { Db } from "victor-db";

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

interface Opts {
  embedString: (str: string) => Promise<Float64Array>;
  db: DBAsync;
}

export class VecDB {
  victor: Db | null = null;
  db: DBAsync;

  static async create(opts: Opts) {
    const db = new VecDB(opts);
    await db.init();
    return db;
  }

  /**
   * Given a string, return a vector embedding of it. The VecDB class is
   * agnostic to how this is done.
   */
  embedString: (str: string) => Promise<Float64Array>;

  constructor(opts: Opts) {
    this.embedString = opts.embedString;
    this.db = opts.db;
  }

  async init() {
    // NOTE: This IS NECESSARY! The constructor returns a promise. Probably
    // something to do with being a Rust lib rather than a JS lib.
    this.victor = await new Db();
  }

  isReady(): this is { victor: Db } {
    return this.victor !== null;
  }

  async searchEmbedding(
    embedding: Float64Array,
    { tags = [], limit = 10 }: { tags?: string[]; limit?: number } = {}
  ) {
    if (!this.isReady()) {
      throw new Error("DB not ready");
    }

    console.time("search");
    const result: VictorDBRecord[] = await this.victor.search(embedding, tags, limit);
    console.timeEnd("search");

    const vecIds = result.map((x) => x.embedding.id);
    const xs = await this.db.execO<FragmentRow & { vec_id: string }>(
      `
      SELECT
        f.*,
        vf.vec_id
      FROM
        vec_to_frag vf
      INNER JOIN
        fragment f ON vf.frag_id = f.id
      WHERE
        vf.vec_id IN (${vecIds.map((_) => "?").join(", ")})
    `,
      vecIds
    );

    return Promise.all(
      result.map(async (x) => {
        const fragment = xs.find((y) => y.vec_id === x.embedding.id);
        return {
          fragment,
          similarity: x.similarity,
          content: x.content,
          embedding: x.embedding,
        };
      })
    );
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

  /**
   * Upsert a record making sure the content is unique to the vector store for this set of tags.
   */
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
      return {
        record: result[0].embedding,
        inserted: false,
      };
    }

    console.time("insert");
    await this.victor.insert(record.content, embedding, record.tags);
    console.timeEnd("insert");

    // Return the new record. Victor does not return it on insert...
    const xs = await this.searchEmbedding(embedding, {
      tags: record.tags,
      limit: 1,
    });

    const newRecord = xs[0].embedding;

    return {
      record: newRecord,
      inserted: true,
    };
  };
}
