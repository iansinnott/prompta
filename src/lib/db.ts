import initWasm, { SQLite3, DB } from "@vlcn.io/crsqlite-wasm";
import wasmUrl from "@vlcn.io/crsqlite-wasm/crsqlite.wasm?url";
import { DB_NAME } from "../lib/constants";
import { db, sqlite, currentThread } from "../lib/stores/stores";
import { dev } from "$app/environment";
import schema from "$lib/schema.sql?raw";

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

  for (const x of schema.split(";")) {
    await _db.exec(x);
  }

  Preferences.get("current-thread-id").then(async (id) => {
    if (id) {
      currentThread.set(await Thread.findUnique({ where: { id } }));
    }
  });

  if (dev) {
    (window as any).db = _db;
    (window as any).Thread = Thread;
  }
};

export interface ChatMessageRow {
  id: number;
  content: string;
  role: "system" | "user" | "assistant";
  created_at: string;
}
export interface ChatMessage {
  id: number;
  content: string;
  role: "system" | "user" | "assistant";
  createdAt: Date;
}

export interface ThreadRow {
  id: number;
  title: string;
  created_at: string;
}
export interface Thread {
  id: number;
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

  async findMany({ threadId }: { threadId: number }): Promise<ChatMessage[]> {
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

  async findFirst(x: { where: { threadId: number; content: string } }) {
    const xs = await _db.execO<ChatMessageRow>(
      `select * from message where thread_id=? and content=? order by created_at desc limit 1`,
      [x.where.threadId, x.where.content]
    );
    return this.rowToModel(xs[0]);
  },

  async create(x: { content: string; role: ChatMessage["role"]; threadId: number }) {
    await _db.exec(`insert into "message" ("content", "role", "thread_id") values(?, ?, ?)`, [
      x.content,
      x.role,
      x.threadId,
    ]);

    return this.findFirst({ where: { content: x.content, threadId: x.threadId } });
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

  async findUnique(x: { where: { id: number } }) {
    const xs = await _db.execO<ThreadRow>(`select * from thread where id=?`, [x.where.id]);
    return this.rowToModel(xs[0]);
  },

  async create(t: { title: string }) {
    await _db.exec(`insert into "thread" ("title") values(?)`, [t.title]);
    return this.findFirst({ where: { title: t.title } });
  },
};

export const Preferences = {
  get: async (k: string) => {
    const rows = await _db.execO<{ value: string | number | boolean | null | undefined }>(
      `select value from preferences where key=?`,
      [k]
    );
    // @ts-ignore
    return rows[0]?.value ? JSON.parse(rows[0].value) : rows[0]?.value;
  },
  set: async (k: string, v: string | number | boolean | null | undefined) => {
    await _db.exec(`insert or replace into preferences(key, value) values(?, ?)`, [
      k,
      JSON.stringify(v),
    ]);
    return v;
  },
};
