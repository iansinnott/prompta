import initWasm, { SQLite3, DB } from "@vlcn.io/crsqlite-wasm";
import wasmUrl from "@vlcn.io/crsqlite-wasm/crsqlite.wasm?url";
import { DB_NAME } from "../lib/constants";
import { db, sqlite, currentThread, openAiConfig, profilesStore } from "../lib/stores/stores";
import { dev } from "$app/environment";
import { nanoid } from "nanoid";
import type { ChatCompletionResponseMessageRoleEnum } from "openai";
import { stringify as uuidStringify } from "uuid";
import { basename } from "./utils";

// ========================================================================================
// Rudimentary Migration System
// ========================================================================================

// The reason for ?url importing migrations is to use their filename as a
// version number.
import schema from "$lib/migrations/00_init.sql?raw"; // NOTE that this is ?raw imported, while migrations are URL imported

// @note Migrations requrie no asset inlining. See vite.config.ts
import migration_01 from "$lib/migrations/01_add_archived.sql?url";
import { getSystem } from "./gui";

// prettier-ignore
const migrations = [
  migration_01,
];

let _sqlite: SQLite3;
let _db: DB;

export const getDbVersion = async (db: DB) => {
  const [[dbVersion]] = await _db.execA<number[]>("PRAGMA user_version");
  return dbVersion;
};

const migrateDb = async (db: DB) => {
  for (const x of schema.split(";")) {
    await _db.exec(x);
  }

  for (const importUrl of migrations) {
    const dbVersion = await getDbVersion(_db);
    const migrationVersion = Number(basename(importUrl)?.split("_")[0]);

    if (dbVersion >= migrationVersion) {
      console.log("%cmigrate skip=true", "color:gray;", {
        dbVersion,
        migrationVersion,
        path: basename(importUrl),
      });
      continue;
    }

    const raw = await fetch(importUrl).then((x) => x.text());
    console.log("%cmigrate", "color:salmon;", "skip=false", {
      dbVersion,
      migrationVersion,
      path: basename(importUrl),
    });
    console.debug(raw);
    let error: null | Error = null;

    for (const x of raw.split(";")) {
      try {
        await _db.exec(x);
      } catch (err: any) {
        error = new Error(err.message + " SQL: " + x);
        break;
      }
    }

    if (error) {
      // NOTE This will generate two alert messages most likely, if the base
      // level error handler also alerts. However the additional context is
      // useful.
      //
      // There's an open question about what to do here. We could roll back the
      // db, but the rest of the app will expect it to be migrated. May or may
      // not cause brakage.
      await getSystem().alert(
        "Could not migrate database. Failed on " + importUrl + "." + (error?.message || "")
      );
      throw error;
    }
  }
};

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

  await migrateDb(_db);

  // Initialize stores
  for (const s of [currentThread, profilesStore, openAiConfig]) {
    await s.init();
  }

  if (dev) {
    for (const [k, v] of [
      ["Thread", Thread],
      ["ChatMessage", ChatMessage],
      ["DatabaseMeta", DatabaseMeta],
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
  model?: string | null;
  cancelled?: boolean | null;
  thread_id: string;
  created_at: string;
}
export interface ChatMessage {
  id: string;
  content: string;
  role: ChatCompletionResponseMessageRoleEnum;
  model?: string | null;
  cancelled?: boolean | null;
  createdAt: Date;
  threadId: string;
}

export interface ThreadRow {
  id: string;
  title: string;
  archived: boolean;
  created_at: string;
}
export type Thread = Omit<ThreadRow, "created_at"> & { createdAt: Date };

const dateFromSqlite = (s: string) => {
  return new Date(s.replace(" ", "T") + "Z");
};

export const DatabaseMeta = {
  async getSiteId() {
    const r = await _db.execA("SELECT crsql_siteid()");
    const raw = r[0][0];
    const siteid = uuidStringify(raw);
    return siteid as string;
  },
};

export const ChatMessage = {
  rowToModel: ({ created_at, thread_id, ...x }: ChatMessageRow): ChatMessage => {
    return {
      ...x,
      createdAt: dateFromSqlite(created_at),
      threadId: thread_id,
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

  async findUnique(x: { where: { id: string } }): Promise<ChatMessage | undefined> {
    const xs = await _db.execO<ChatMessageRow>(`select * from "message" where id=?`, [x.where.id]);
    return xs.length ? this.rowToModel(xs[0]) : undefined;
  },

  /**
   * Create a record in the db. Accepts an optional ID so that we can create a
   * message elsewhere and then persist it
   */
  async create(x: {
    content: string;
    role: ChatMessage["role"];
    threadId: string;
    id?: string;
    model?: string | null;
    cancelled?: boolean | null;
  }) {
    const cid = x.id || nanoid();
    await _db.exec(
      `insert into "message" ("id", "content", "role", "model", "cancelled", "thread_id") values(?, ?, ?, ?, ?, ?)`,
      [cid, x.content, x.role, x.model ?? "", x.cancelled ? 1 : 0, x.threadId]
    );

    return this.findUnique({ where: { id: cid } });
  },

  async delete(x: { where: { id?: string; threadId?: string } }) {
    const { id, threadId } = x.where;
    if (!id && !threadId) {
      throw new Error("Must provide either id or threadId");
    }

    const where = id ? `id=?` : `thread_id=?`;
    const args = id ? [id] : [threadId];

    // @ts-ignore
    await _db.exec(`delete from "message" where ${where}`, args);
  },

  async _removeAll() {
    if (!dev) {
      console.warn(
        "_removeAll is meant for dev use. revisit the source code if you think this is a mistake."
      );
    }

    if (!(await window.confirm("All messages will be removed. Continue?"))) {
      return;
    }

    await _db.exec(`drop table "message"`);

    return true;
  },
};

export const Thread = {
  rowToModel: ({ created_at, ...x }: ThreadRow): Thread => {
    return {
      ...x,
      createdAt: dateFromSqlite(created_at),
    };
  },

  async findMany({ where: { archived = false } = {} } = {}): Promise<Thread[]> {
    const rows = await _db.execO<ThreadRow>(
      `
      SELECT * FROM "thread" 
      WHERE archived=?
      ORDER BY "created_at" DESC
    `,
      [archived ? 1 : 0]
    );
    return rows.map((row) => this.rowToModel(row));
  },

  async findFirst(x: { where: { title: string } }) {
    const xs = await _db.execO<ThreadRow>(
      `select * from thread where title=? order by created_at desc limit 1`,
      [x.where.title]
    );
    return this.rowToModel(xs[0]);
  },

  async findUnique(x: { where: { id: string } }): Promise<Thread | undefined> {
    const xs = await _db.execO<ThreadRow>(`select * from thread where id=?`, [x.where.id]);
    return xs[0] ? this.rowToModel(xs[0]) : undefined;
  },

  async create(t: { title: string }) {
    const cid = nanoid();
    await _db.exec(`insert into "thread" ("id", "title") values(?, ?)`, [cid, t.title]);
    return this.findUnique({ where: { id: cid } }) as Promise<Thread>;
  },

  async update(x: { where: { id: string }; data: Partial<Record<keyof Thread, any>> }) {
    if (!x.where.id) {
      throw new Error("Must provide id");
    }

    const keysValues = Object.entries(x.data);
    const updateExpressions = keysValues.map(([key]) => `${key}=?`).join(",");
    const queryParams = keysValues.flatMap(([, value]) => value).concat(x.where.id);

    await _db.exec(`update "thread" set ${updateExpressions} where id=?`, queryParams);
    return this.findUnique({ where: x.where }) as Promise<Thread>;
  },

  async _removeAll() {
    if (!dev) {
      console.warn(
        "_removeAll is meant for dev use. revisit the source code if you think this is a mistake."
      );
    }

    if (!(await window.confirm("All records will be removed. Continue?"))) {
      return;
    }

    await _db.exec(`drop table "thread"`);

    return true;
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
  setEntries: async (entries: [string, any][]) => {
    const values = entries.map(([k, v]) => `(?, ?)`).join(", ");
    const args = entries.flatMap(([k, v]) => [k, JSON.stringify(v)]);
    await _db.exec(`INSERT OR REPLACE INTO "preferences" (key, value) values ${values}`, args);
    return entries;
  },

  getEntries: async (x: { where: { like: string } }) => {
    const rows = await _db.execO<{ key: string; value: string }>(
      `select * from "preferences" where "key" like ?`,
      [x.where.like]
    );
    return rows.map((row) => {
      return [row.key, JSON.parse(row.value)];
    });
  },

  async _removeAll() {
    if (!dev) {
      console.warn(
        "_removeAll is meant for dev use. revisit the source code if you think this is a mistake."
      );
    }

    if (!(await window.confirm("All records will be removed. Continue?"))) {
      return;
    }

    await _db.exec(`delete from "preferences" where 1=1`);

    return true;
  },
};

export async function _clearDatabase() {
  // If the first one was accepted, proceed with the rest
  const removed = await ChatMessage._removeAll();
  if (removed) {
    await Thread._removeAll();
    // Not removing preferences.
    // await Preferences._removeAll();
    window.location.reload();
  }
}

if (dev) {
  (window as any)._clearDatabase = _clearDatabase;
}
