import initWasm, { SQLite3, DB } from "@vlcn.io/crsqlite-wasm";
import wasmUrl from "@vlcn.io/crsqlite-wasm/crsqlite.wasm?url";
import { marked } from "marked";
import { DB_NAME } from "../lib/constants";
import {
  db,
  sqlite,
  currentThread,
  openAiConfig,
  profilesStore,
  syncStore,
  isNewThread,
  newThread,
} from "../lib/stores/stores";
import { dev } from "$app/environment";
import { nanoid } from "nanoid";
import type { ChatCompletionResponseMessageRoleEnum } from "openai";
import { stringify as uuidStringify } from "uuid";
import { basename, debounce, groupBy, sha1sum, toCamelCase, toSnakeCase } from "./utils";
import { extractFragments } from "./markdown";
import tblrx, { TblRx } from "@vlcn.io/rx-tbl";

// ========================================================================================
// Rudimentary Migration System
// ========================================================================================

// The reason for ?url importing migrations is to use their filename as a
// version number.
import schema from "$lib/migrations/00_init.sql?raw"; // NOTE that this is ?raw imported, while migrations are URL imported

// @note Migrations requrie no asset inlining. See vite.config.ts
import migration_01 from "$lib/migrations/01_add_archived.sql?url";
import migration_02 from "$lib/migrations/02_add_fts.sql?url";
import { getSystem } from "./gui";

// prettier-ignore
const migrations = [
  migration_01,
  migration_02,
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

    // for (const x of raw.split(";")) {
    try {
      await _db.exec(raw);
    } catch (err: any) {
      error = new Error(err.message + " SQL: " + raw);
      break;
    }
    // }

    if (error) {
      // NOTE This will generate two alert messages most likely, if the base
      // level error handler also alerts. However the additional context is
      // useful.
      //
      // There's an open question about what to do here. We could roll back the
      // db, but the rest of the app will expect it to be migrated. May or may
      // not cause brakage.
      await getSystem().alert(
        // @ts-expect-error thinks error is never?
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

  // table-wise reactivity
  const rx = tblrx(_db);

  const subs: (() => void)[] = [];
  subs.push(Thread.initRx(rx));
  subs.push(ChatMessage.initRx(rx));

  window.onbeforeunload = () => {
    if (_db) {
      console.debug("Closing db connection");
      _db.close();
    }

    syncStore.dispose();

    for (const unsub of subs) {
      unsub();
    }
  };

  if (dev) {
    for (const [k, v] of [
      ["Thread", Thread],
      ["ChatMessage", ChatMessage],
      ["DatabaseMeta", DatabaseMeta],
      ["Preferences", Preferences],
      ["Fragment", Fragment],
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
  role: ChatCompletionResponseMessageRoleEnum | string;
  model?: string | null;
  cancelled?: boolean | null;
  thread_id: string;
  created_at: string;
}
export interface ChatMessage {
  id: string;
  content: string;
  role: ChatCompletionResponseMessageRoleEnum | string;
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

export interface FragmentRow {
  id: string;
  entity_id: string;
  entity_type: string;
  attribute: string;
  value: string;
  created_at: string;
}
export type Fragment = Omit<FragmentRow, "created_at"> & { createdAt: Date };

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

interface CRUDConf<T> {
  tableName: string;
  fromDbKey?: (x: string) => string;
  toDbKey?: (x: any) => string;
  fromDbValue?: (x: any) => any;
  toDbValue?: (x: any) => any;
  rowToModel?: (x: any) => T;
  generateId?: (x: Partial<T>) => Promise<any> | any;
}

type Comparator<T> = {
  [K in keyof T]?: T[K] | { contains?: T[K] } | { in?: T[K][] };
};

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
  rowToModel = (x) => x as T,
  generateId = () => nanoid(),
}: CRUDConf<T>) => {
  const listeners = new Set<() => void>();
  return {
    _listeners: listeners,

    rowToModel,

    onTableChange(cb: () => void) {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },

    async create(t: Partial<T>) {
      const fields: any[] = [];
      const values: any[] = [];
      const placeholders: string[] = [];

      Object.entries(t).forEach(([key, value]) => {
        fields.push(`"${toDbKey(key)}"`);
        values.push(toDbValue(value));
        placeholders.push("?");
      });

      const cid = t.id || (await generateId(t));
      if (!fields.includes('"id"')) {
        fields.push('"id"');
        values.push(cid);
        placeholders.push("?");
      }

      const query = `INSERT INTO "${tableName}" (${fields.join(", ")}) VALUES(${placeholders.join(
        ", "
      )})`;

      await _db.exec(query, values);

      return this.findUnique({ where: { id: cid } }) as Promise<T>;
    },

    async createBulk(ts: Partial<T>[]) {
      const allFields: string[] = [];
      const allValues: any[] = [];
      const allPlaceholders: string[] = [];

      for (const [i, t] of ts.entries()) {
        const fields: any[] = [];
        const values: any[] = [];
        const placeholders: string[] = [];

        Object.entries(t).forEach(([key, value]) => {
          fields.push(`"${toDbKey(key)}"`);
          values.push(toDbValue(value));
          placeholders.push("?");
        });

        const cid = t.id || (await generateId(t));
        if (!fields.includes('"id"')) {
          fields.push('"id"');
          values.push(cid);
          placeholders.push("?");
        }

        if (i === 0) {
          allFields.push(...fields);
        }

        allValues.push(...values);
        allPlaceholders.push(`(${placeholders.join(", ")})`);
      }

      const query = `INSERT INTO "${tableName}" (${allFields.join(
        ", "
      )}) VALUES ${allPlaceholders.join(", ")}`;

      await _db.exec(query, allValues);

      const createdRecords = (await this.findMany({ where: { id: { in: allValues } } })) as T[];

      return createdRecords;
    },

    async findUnique(x: { where: { id: string } }): Promise<T | undefined> {
      const xs = await _db.execO<ThreadRow>(`select * from "${tableName}" where id=? limit 1`, [
        x.where.id,
      ]);
      return xs[0] ? rowToModel(xs[0]) : undefined;
    },

    async findMany({
      where,
      orderBy,
      limit,
    }: {
      where?: { [P in keyof T]?: T[P] | Comparator<T>[P] | undefined };
      orderBy?: Partial<Record<keyof T, "ASC" | "DESC">>;
      limit?: number;
    } = {}): Promise<T[]> {
      let query = `
      SELECT * FROM "${tableName}"
    `;
      const queryParams: any[] = [];

      if (where) {
        const whereClauses = Object.entries(where)
          .map(([key, value]) => {
            if (typeof value === "object" && value !== null) {
              if ("contains" in value) {
                queryParams.push(`%${value.contains}%`);
                return `${toDbKey(key)} LIKE ?`;
              } else if ("in" in value) {
                const placeholders = value.in.map(() => "?").join(", ");
                queryParams.push(...value.in);
                return `${toDbKey(key)} IN (${placeholders})`;
              } else {
                throw new Error(`Unknown comparator ${JSON.stringify(value)}`);
              }
            } else {
              queryParams.push(value);
              return `${toDbKey(key)}=?`;
            }
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

      if (limit) {
        query += ` LIMIT ${limit}`;
      }

      const rows = await _db.execO<T>(query, queryParams);

      return rows.map((row) => rowToModel(row));
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

    async update(x: { where: { id: string }; data: Partial<Record<keyof T, any>> }) {
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

    async findFirst(x: Omit<Parameters<typeof this.findMany>[0], "limit">): Promise<T | null> {
      const xs = await this.findMany(x);
      return xs[0] ?? null;
    },

    async delete(x: { where: Partial<Record<keyof T, any>> }) {
      if (!x.where.id) {
        console.warn("Mass deletion", x);
      }

      const keysValues = Object.entries(x.where);
      const deleteWhere = keysValues.map(([key]) => `${toDbKey(key)}=?`).join(" AND ");
      const queryParams = keysValues.flatMap(([, value]) => value);
      const sql = `delete from "${tableName}" where ${deleteWhere}`;
      await _db.exec(sql, queryParams);
    },

    async softDelete(x: { where: Partial<Record<keyof T, any>> }) {
      if (!x.where.id) {
        console.warn(tableName, "Soft deletion", x);
      }

      const records = await this.findMany(x);

      if (!records.length) {
        console.warn(tableName, "No records to delete", x);
      }

      for (const record of records) {
        await _db.exec(`insert into "deleted_record" (id, table_name, data) values (?, ?, ?)`, [
          record.id,
          tableName,
          JSON.stringify(record),
        ]);
        await _db.exec(`delete from "${tableName}" where id=?`, [record.id]);
      }
    },

    initRx(rx: TblRx) {
      return rx.onRange([tableName], () => {
        listeners.forEach((cb) => cb());
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

      await _db.exec(`delete from "${tableName}"`);

      return true;
    },

    generateId,
  };
};

export const ChatMessage = {
  ...crud<ChatMessage>({
    tableName: "message",
    rowToModel: ({ created_at, thread_id, ...x }: ChatMessageRow): ChatMessage => {
      return {
        ...x,
        createdAt: dateFromSqlite(created_at),
        threadId: thread_id,
      };
    },
  }),

  /**
   * Find all the context for sending to openai. Initially abstracted becuase we
   * support other 'roles' besides those that openai supports
   */
  async findThreadContext({
    threadId,
  }: {
    threadId: string;
  }): Promise<Array<Omit<ChatMessage, "role"> & { role: ChatCompletionResponseMessageRoleEnum }>> {
    const context = await ChatMessage.findMany({
      where: {
        threadId,
        role: {
          in: ["user", "system", "assistant"] as ChatCompletionResponseMessageRoleEnum[],
        },
      },
      orderBy: { createdAt: "ASC" },
    });
    return context as Array<
      Omit<ChatMessage, "role"> & { role: ChatCompletionResponseMessageRoleEnum }
    >;
  },
};

export const Thread = {
  ...crud<Thread>({
    tableName: "thread",
    rowToModel: ({ created_at, ...x }: ThreadRow): Thread => {
      return {
        ...x,
        createdAt: dateFromSqlite(created_at),
      };
    },
  }),
  async fullTextSearch(content: string) {
    const rows = await _db.execO<ThreadRow>(
      `
      select * from thread
      where id in (
        select thread_id from message
        where content like ?
      )
    `,
      [`%${content}%`]
    );

    return rows.map((row) => Thread.rowToModel(row));
  },
};

export type FragmentSearchResult = Fragment & { rank: number; snippet: string; thread_id: string };

export const Fragment = {
  ...crud<Fragment>({
    generateId: async (x) => {
      const sha = await sha1sum(x.entity_id + (x.entity_type as string) + x.attribute + x.value);
      return parseInt(sha.slice(0, 12), 16); // Note we must use ints here for sqlite rowid
    },
    tableName: "fragment",
    rowToModel: ({ created_at, ...x }: FragmentRow): Fragment => {
      return {
        ...x,
        createdAt: dateFromSqlite(created_at),
      };
    },
  }),
  async fullTextSearch(
    content: string,
    { archived }: { archived?: boolean } = {
      archived: false,
    }
  ) {
    const rows = await _db.execO<
      FragmentRow & { rank: number; snippet: string; thread_id: string }
    >(
      `
      SELECT
        m.thread_id,
        fts.*,
        fts.rank,
        snippet (fragment_fts, -1, '<mark>', '</mark>', '…', 18) AS snippet
      FROM
        fragment_fts fts
        LEFT OUTER JOIN message m ON m.id = fts.entity_id
      WHERE
        fragment_fts MATCH ?
        AND fts.entity_type = 'message'
      ORDER BY
        CREATED_AT DESC
      LIMIT 500
      ;
    `,
      [content]
    );

    const threads = await Thread.findMany({
      where: { archived, id: { in: rows.map((x) => x.thread_id) } },
    });
    const fragments = rows.map((row) => Fragment.rowToModel(row));

    // @ts-expect-error getting thrown off by the addition of rank and snippet
    const groups = groupBy(fragments, (x) => x.thread_id);

    return threads.map((thread) => {
      return {
        ...thread,
        fragments: groups[thread.id],
      };
    });
  },
};

const pendingOps: any[] = [];

const attemptCommit = debounce(async () => {
  if (!pendingOps.length) {
    console.log("%cops complete", "color:lime;");
    return;
  }

  let op;

  while ((op = pendingOps.shift())) {
    try {
      await op();
      console.log("%cops complete", "color:lime;");
    } catch (e) {
      console.error(e);
      pendingOps.unshift(op); // put it back in the queue
      break;
    }
  }
}, 1000);

const syncThraedFragments = debounce(() => {
  (async () => {
    const newThreads = await _db.execO<{ id: string; title: string }>(
      `
    SELECT id, title
    FROM
      "thread"
    WHERE
      thread.id NOT IN (SELECT entity_id FROM fragment WHERE entity_type = 'thread')
      AND title != ?
    ;
  `,
      [newThread.title]
    );

    console.debug("inserting new threads", newThreads.length);

    await _db.tx(async (tx) => {
      for (const [i, x] of newThreads.entries()) {
        console.debug("creating fragment for thread", `index=${i}`, `id=${x.id}`, x);
        await tx.exec(
          `INSERT INTO fragment (entity_id, entity_type, attribute, value)
                         VALUES (?, ?, ?, ?)`,
          [x.id, "thread", "title", x.title]
        );
        // await Fragment.create({
        //   entity_id: x.id,
        //   entity_type: "thread",
        //   attribute: "title",
        //   value: x.title,
        // });
      }
    });

    // Threads once trashed are no longer searchable
    //   await _db.execO<{ id: string }>(
    //     `
    //   DELETE FROM "fragment"
    //   WHERE fragment.entity_type = 'thread'
    //     AND fragment.entity_id NOT IN ( SELECT id FROM "thread")
    //     ;
    // `
    //   );
  })();
}, 1000);

(window as any).syncThraedFragments = syncThraedFragments;

Thread.onTableChange(syncThraedFragments);

ChatMessage.onTableChange(() => {
  pendingOps.push(async () => {
    const xs = await _db.execO<{ id: string; content: string }>(`
  select id, content from "message" 
    where message.id not in (select entity_id from fragment where entity_type='message')
  `);

    for (const x of xs) {
      const fragments = await extractFragments(x.content);
      console.debug("[search fragments]", fragments);
      for (const fragment of fragments) {
        await Fragment.create({
          entity_id: x.id,
          entity_type: "message",
          attribute: "content",
          value: fragment,
        });
      }
    }

    // Threads once trashed are no longer searchable
    await _db.execO<{ id: string }>(
      `
  delete from "fragment" 
    where fragment.entity_type='message' 
      and fragment.entity_id not in (select id from "message")
  `
    );
  });

  attemptCommit();
});

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
