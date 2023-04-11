import initWasm, { SQLite3, DB } from "@vlcn.io/crsqlite-wasm";
import wasmUrl from "@vlcn.io/crsqlite-wasm/crsqlite.wasm?url";
import { DB_NAME } from "../lib/constants";
import { db, sqlite, currentThread, openAiConfig } from "../lib/stores/stores";
import { dev } from "$app/environment";
import schema from "$lib/schema.sql?raw";
import { nanoid } from "nanoid";
import type { ChatCompletionResponseMessageRoleEnum } from "openai";

let _sqlite: SQLite3;
let _db: DB;

export const initDb = async () => {
  if (_db) {
    console.debug("DB already initialized");
    return;
  }

  // @note This only works in the browser. Don't use SSR anywhere where you need this
  _sqlite = await initWasm(() => wasmUrl);
  sqlite.set(_sqlite);

  _db = await _sqlite.open(DB_NAME);
  db.set(_db);

  // Migrate schema. Super simple, assumes idempotent migrations as it re-runs them every time
  for (const x of schema.split(";")) {
    await _db.exec(x);
  }

  const threadId = await Preferences.get("current-thread-id");

  if (threadId) {
    const thread = await Thread.findUnique({ where: { id: threadId } });
    console.debug("hydrate thread", thread);
    currentThread.set(thread);
  }

  const conf = await Preferences.get("openai-config");
  if (conf) {
    openAiConfig.set(conf);
  }

  if (dev) {
    for (const [k, v] of [
      ["Thread", Thread],
      ["ChatMessage", ChatMessage],
      ["Preferences", Preferences],
      ["db", _db],
    ]) {
      // @ts-expect-error Just for dev, and the error is not consequential
      (window as any)[k] = v;
    }
  }
};

export interface ChatMessageRow {
  id: string;
  content: string;
  role: ChatCompletionResponseMessageRoleEnum;
  created_at: string;
}
export interface ChatMessage {
  id: string;
  content: string;
  role: ChatCompletionResponseMessageRoleEnum;
  createdAt: Date;
}

export interface ThreadRow {
  id: string;
  title: string;
  created_at: string;
}
export interface Thread {
  id: string;
  title: string;
  createdAt: Date;
}

const dateFromSqlite = (s: string) => {
  return new Date(s.replace(" ", "T") + "Z");
};

export const ChatMessage = {
  rowToModel: ({ created_at, ...x }: ChatMessageRow): ChatMessage => {
    return {
      ...x,
      createdAt: dateFromSqlite(created_at),
    };
  },

  async findMany({ threadId }: { threadId: string }): Promise<ChatMessage[]> {
    if (!threadId) {
      throw new Error("Tried to query messages without thread id");
    }

    const rows = await _db.execO<ChatMessageRow>(
      `
      SELECT * FROM "message" 
      WHERE thread_id=?
      ORDER BY "created_at" ASC
    `,
      [threadId]
    );

    return rows.map((row) => this.rowToModel(row));
  },

  async findFirst(x: { where: { threadId: string; content: string } }) {
    const xs = await _db.execO<ChatMessageRow>(
      `select * from message where thread_id=? and content=? order by created_at desc limit 1`,
      [x.where.threadId, x.where.content]
    );
    return this.rowToModel(xs[0]);
  },

  async findUnique(x: { where: { id: string } }) {
    const xs = await _db.execO<ChatMessageRow>(`select * from "message" where id=?`, [x.where.id]);
    return this.rowToModel(xs[0]);
  },

  async create(x: { content: string; role: ChatMessage["role"]; threadId: string }) {
    const cid = nanoid();
    await _db.exec(
      `insert into "message" ("id", "content", "role", "thread_id") values(?, ?, ?, ?)`,
      [cid, x.content, x.role, x.threadId]
    );

    return this.findUnique({ where: { id: cid } });
  },
};

export const Thread = {
  rowToModel: ({ created_at, ...x }: ThreadRow): Thread => {
    return {
      ...x,
      createdAt: dateFromSqlite(created_at),
    };
  },

  async findMany(): Promise<Thread[]> {
    const rows = await _db.execO<ThreadRow>(`select * from "thread" order by "created_at" desc`);
    return rows.map((row) => this.rowToModel(row));
  },

  async findFirst(x: { where: { title: string } }) {
    const xs = await _db.execO<ThreadRow>(
      `select * from thread where title=? order by created_at desc limit 1`,
      [x.where.title]
    );
    return this.rowToModel(xs[0]);
  },

  async findUnique(x: { where: { id: string } }) {
    const xs = await _db.execO<ThreadRow>(`select * from thread where id=?`, [x.where.id]);
    return this.rowToModel(xs[0]);
  },

  async create(t: { title: string }) {
    const cid = nanoid();
    await _db.exec(`insert into "thread" ("id", "title") values(?, ?)`, [cid, t.title]);
    return this.findUnique({ where: { id: cid } });
  },
};

export const Preferences = {
  async findMany() {
    const rows = await _db.execO<{ key: string; value: string }>(
      `select * from preferences order by ROWID asc`
    );
    return rows.map((row) => {
      return {
        key: row.key,
        value: JSON.parse(row.value),
      };
    });
  },
  get: async (k: string) => {
    const rows = await _db.execO<{ value: string | number | boolean | null | undefined }>(
      `select value from preferences where key=?`,
      [k]
    );
    // @ts-ignore
    return rows[0]?.value ? JSON.parse(rows[0].value) : rows[0]?.value;
  },
  set: async (k: string, v: any) => {
    await _db.exec(`insert or replace into preferences(key, value) values(?, ?)`, [
      k,
      JSON.stringify(v),
    ]);
    return v;
  },
};
