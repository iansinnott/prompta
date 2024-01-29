import type { FragmentRow, SemanticFragmentRow } from "$lib/db";
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
  events = new EventTarget();

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

    let embedding: Float64Array | undefined;
    let error: Error | undefined;
    console.time("embedString");
    for (let i = 0; i < 3; i++) {
      try {
        embedding = await this.embedString(record.content);
        break;
      } catch (e) {
        console.warn("Error embedding string. Retrying...");
        error = e;
      }
    }
    console.timeEnd("embedString");

    if (!embedding) {
      throw new Error("Could not embed string: " + error?.message || "Unknown error");
    }

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

  /**
   * This is a very destructive operation, but the vectors are all derived data
   * so it should be fine. It just takes a bit of time to derive them.
   */
  clear = async () => {
    if (!this.isReady()) {
      throw new Error("Could not connect to database");
    }

    await this.victor.clear();
    await this.db.exec(`DELETE FROM vec_to_frag`);
  };

  #ingestInProgress = false;

  ingestFragments = async () => {
    if (!this.isReady()) {
      throw new Error("Could not connect to database");
    }

    if (this.#ingestInProgress) {
      console.warn("Ingest already in progress. Ignoring ingest request");
      return;
    }

    this.#ingestInProgress = true;

    // How many to do at once?
    const batchSize = 100;

    const getCount = async () => {
      let [{ count }] = await this.db.execO<{ count: number }>(`
      SELECT
        COUNT(*) as 'count'
      FROM
        fragment f
        INNER JOIN message m ON m.id = f.entity_id
      WHERE
        f.id NOT IN (SELECT vf.frag_id FROM vec_to_frag vf);
    `);
      return count;
    };

    try {
      let remaining = await getCount();

      this.events.dispatchEvent(new CustomEvent("ingest-start", { detail: { remaining } }));

      while (remaining > 0) {
        console.log("records to process:", remaining);
        const fragments = await this.db.execO<SemanticFragmentRow>(
          `
      SELECT
        m.role,
        m.thread_id,
        m.created_at,
        m.id as 'message_id',
        f.id,
        f.value,
        f.entity_type
      FROM
        fragment f
        INNER JOIN message m ON m.id = f.entity_id
      WHERE
        f.id NOT IN (SELECT vf.frag_id FROM vec_to_frag vf)
      ORDER BY
        m.created_at ASC
      LIMIT
        ?;
    `,
          [batchSize]
        );

        const records = fragments.map((x) => {
          return {
            content: x.value,
            tags: [x.role, x.thread_id, x.entity_type],
            id: x.id,
          };
        });

        // @todo Maybe it would make more sense to do this in the upsert call
        // Victor does NOT like parallel upserts it seems. Last time I tried, it crashed.
        console.time("upsert fragments");
        for (const [i, { id, ...record }] of records.entries()) {
          const result = await this.upsert(record);
          console.debug("inserted", result);
          const [existing] = await this.db.execO<{ id: string }>(
            `SELECT id FROM "vec_to_frag" WHERE "frag_id" = ?`,
            [id]
          );
          if (!existing) {
            await this.db.exec(`INSERT INTO "vec_to_frag" ("vec_id", "frag_id") VALUES(?, ?)`, [
              result.record.id,
              id,
            ]);
          }

          if (i % 3 === 0) {
            this.events.dispatchEvent(
              new CustomEvent("ingest-progress", { detail: { remaining: remaining - i } })
            );
          }
        }
        console.timeEnd("upsert fragments");

        remaining = await getCount();
      }
    } catch (error) {
      console.error("Error ingesting fragments", error);
      throw error;
    } finally {
      this.#ingestInProgress = false;
      this.events.dispatchEvent(new CustomEvent("ingest-end"));
    }
  };
}
