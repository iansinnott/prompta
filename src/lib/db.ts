import initWasm, { SQLite3, DB } from "@vlcn.io/crsqlite-wasm";
import wasmUrl from "@vlcn.io/crsqlite-wasm/crsqlite.wasm?url";
import { DB_NAME } from "../lib/constants";
import { db, sqlite, currentThread, openAiConfig, profilesStore } from "../lib/stores/stores";
import { dev } from "$app/environment";
import { nanoid } from "nanoid";
import type { ChatCompletionResponseMessageRoleEnum } from "openai";
import { stringify as uuidStringify } from "uuid";
import { basename, toCamelCase, toSnakeCase } from "./utils";

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

const sqliteFromDate = (date: Date) => {
  return date.toISOString().replace("T", " ").replace("Z", "");
};

export const DatabaseMeta = {
  async getSiteId() {
    const r = await _db.execA("SELECT crsql_siteid()");
    const raw = r[0][0];
    const siteid = uuidStringify(raw);
    return siteid as string;
  },
};

interface CRUDConf {
  tableName: string;
  fromDbKey?: (x: string) => string;
  toDbKey?: (x: any) => string;
  fromDbValue?: (x: any) => any;
  toDbValue?: (x: any) => any;
}

const crud = <T extends { id: string }>({
  tableName,
  fromDbKey = toCamelCase,
  toDbKey = (x) => toSnakeCase(String(x)),
  fromDbValue = (x) => {
    // NOTE we don't assume anything here. judging whether a string is meant to be a string or a date could ge hairy
    return x;
  },
  toDbValue = (x) => {
    if (x instanceof Date) {
      return sqliteFromDate(x);
    }

    return x;
  },
}: CRUDConf) => {
  return {
    async create(t: Partial<T>) {
      const fields: any[] = [];
      const values: any[] = [];
      const placeholders: string[] = [];

      Object.entries(t).forEach(([key, value]) => {
        fields.push(`"${toDbKey(key)}"`);
        values.push(toDbValue(value));
        placeholders.push("?");
      });

      const cid = t.id || nanoid();
      if (!fields.includes('"id"')) {
        fields.push('"id"');
        values.push(cid);
        placeholders.push("?");
      }

      const query = `INSERT INTO "${tableName}" (${fields.join(", ")}) VALUES(${placeholders.join(
        ", "
      )})`;

      console.debug(t, query, values);
      await _db.exec(query, values);
      return this.findUnique({ where: { id: cid } }) as Promise<T>;
    },

    async findUnique(x: { where: { id: string } }): Promise<T | undefined> {
      const xs = await _db.execO<ThreadRow>(`select * from "${tableName}" where id=? limit 1`, [
        x.where.id,
      ]);
      // @ts-expect-error Types don't know yet
      return xs[0] ? this.rowToModel(xs[0]) : undefined;
    },

    async findMany({
      where,
      orderBy,
    }: {
      where?: Partial<T>;
      orderBy?: Partial<Record<keyof T, "ASC" | "DESC">>;
    } = {}): Promise<T[]> {
      let query = `
      SELECT * FROM "${tableName}"
    `;
      const queryParams: any[] = [];

      if (where) {
        const whereClauses = Object.entries(where)
          .map(([key, value]) => {
            queryParams.push(value);
            return `${toDbKey(key)}=?`;
          })
          .join(" AND ");

        if (whereClauses) {
          query += `WHERE ${whereClauses}`;
        }
      }

      if (orderBy) {
        const [[orderByKey, direction]] = Object.entries(orderBy);
        query += ` ORDER BY "${toDbKey(orderByKey)}" ${direction}`;
      } else {
        query += ' ORDER BY "created_at" DESC';
      }

      const rows = await _db.execO<T>(query, queryParams);

      // @ts-expect-error Types don't know yet
      return rows.map((row) => this.rowToModel(row));
    },

    async upsert(data: Partial<T>) {
      console.debug("upsert", tableName, data);

      // NOTE `create` cases are separated for reader clarity, but could be combined
      if (!data.id) {
        return this.create(data as T); // If no ID, then create it
      } else if (!(await this.findUnique({ where: { id: data.id } }))) {
        return this.create(data as T); // If there _is_ an ID but it's not in the database, then create it (used for importing)
      } else {
        return this.update({ where: { id: data.id }, data });
      }
    },

    async update(x: { where: { id: string }; data: Partial<Record<keyof Thread, any>> }) {
      if (!x.where.id) {
        throw new Error("Must provide id");
      }

      const keysValues = Object.entries(x.data);
      const updateExpressions = keysValues.map(([key]) => `${toDbKey(key)}=?`).join(",");
      const queryParams = keysValues.flatMap(([, value]) => value).concat(x.where.id);

      const sql = `update "${tableName}" set ${updateExpressions} where id=?`;
      await _db.exec(sql, queryParams);
      return this.findUnique({ where: x.where }) as Promise<T>;
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

      await _db.exec(`delete from "${tableName}"`);

      return true;
    },
  };
};

export const ChatMessage = {
  rowToModel: ({ created_at, thread_id, ...x }: ChatMessageRow): ChatMessage => {
    return {
      ...x,
      createdAt: dateFromSqlite(created_at),
      threadId: thread_id,
    };
  },

  async findFirst(x: { where: { threadId: string; content: string } }) {
    const xs = await _db.execO<ChatMessageRow>(
      `select * from message where thread_id=? and content=? order by created_at desc limit 1`,
      [x.where.threadId, x.where.content]
    );
    return this.rowToModel(xs[0]);
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

  ...crud<ChatMessage>({ tableName: "message" }),
};

export const Thread = {
  rowToModel: ({ created_at, ...x }: ThreadRow): Thread => {
    return {
      ...x,
      createdAt: dateFromSqlite(created_at),
    };
  },

  async findFirst(x: { where: { title: string } }) {
    const xs = await _db.execO<ThreadRow>(
      `select * from thread where title=? order by created_at desc limit 1`,
      [x.where.title]
    );
    return this.rowToModel(xs[0]);
  },

  ...crud<Thread>({ tableName: "thread" }),
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

    await _db.exec(`delete from "preferences"`);

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
