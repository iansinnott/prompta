import Database from "better-sqlite3";
import { extensionPath } from "@vlcn.io/crsqlite";
import { cryb64, Change, Changes } from "@vlcn.io/ws-common";
import path from "path";
import fs from "fs";
const DB_FOLDER = process.env.RAILWAY_VOLUME_MOUNT_PATH || "./dbs";
const SCHEMA_FOLDER = path.join(DB_FOLDER, "schemas");

/**
 * - Initializes SQLite
 * - Loads the cr-sqlite extension
 * - Exposes `push` and `pull` changes statements
 *
 */
export class DBWrapper {
  readonly #db;
  readonly #getChangesStmt;
  readonly #applyChangesStmt;

  constructor(db: Database.Database) {
    this.#db = db;
    this.#getChangesStmt = this.#db
      .prepare(
        `SELECT "table", "pk", "cid", "val", "col_version", "db_version", NULL, "cl", "seq" FROM crsql_changes WHERE db_version > ? AND site_id IS NOT ?`
      )
      .raw(true)
      .safeIntegers();
    this.#applyChangesStmt = this.#db.prepare(
      `INSERT INTO crsql_changes
        ("table", "pk", "cid", "val", "col_version", "db_version", "site_id", "cl", "seq")
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
  }

  getChanges(sinceVersion: bigint, requestorSiteId: Uint8Array): Change[] {
    return this.#getChangesStmt.all(sinceVersion, requestorSiteId) as any;
  }

  getId(): Uint8Array {
    return this.#db.prepare(`SELECT crsql_site_id()`).pluck().get() as Uint8Array;
  }

  applyChanges(msg: Changes) {
    this.#db.transaction((msg) => {
      for (const c of msg.changes) {
        this.#applyChangesStmt.run(c[0], c[1], c[2], c[3], c[4], c[5], msg.sender, c[7], c[8]);
      }
    })(msg);
  }

  close() {
    closeDb(this.#db);
  }

  static async registerSchema(schemaName: string, content: string) {
    await fs.promises.mkdir(SCHEMA_FOLDER, { recursive: true });
    const version = cryb64(content);
    const filePath = getSchemaPath(schemaName);
    let result: {
      status: "ok" | "error" | "noop";
      version: string;
      error?: {
        message: string;
        stack?: string;
        code?: string;
      };
    };

    try {
      await fs.promises.writeFile(filePath, content, { flag: "wx" });
      result = {
        status: "ok",
        version: version.toString(),
      };
    } catch (error) {
      if (error.code === "EEXIST") {
        result = {
          status: "noop",
          version: version.toString(),
          error: {
            message: `Schema file ${filePath} already exists.`,
            code: "schema_already_exists",
          },
        };
      } else {
        result = {
          status: "error",
          version: version.toString(),
          error: {
            message: error.message,
            stack: error.stack,
            code: error.code,
          },
        };
      }
    }

    return result;
  }
}

/**
 * Note: In a production environment, you should cache the DB instance and
 * so you can re-use it between requests. Reconstructing SQLite and
 * re-preparing statements every request is non-trivial.
 *
 * @param room
 * @param requestedSchemaName
 * @param requestedVersion
 * @returns DBWrapper
 */
export async function createDb(
  room: string,
  requestedSchemaName: string,
  requestedVersion: bigint
) {
  const dbpath = getDbPath(room);
  await fs.promises.mkdir(DB_FOLDER, { recursive: true });
  const db = new Database(dbpath);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.loadExtension(extensionPath);

  // NOTE:
  // This set of code "auto migrates" the database to the requested schema version.
  // You can eject this code and handle migration manually if you prefer
  // as auto-migration has it limitations.
  const schemaVersion = db
    .prepare(`SELECT value FROM crsql_master WHERE key = ?`)
    .safeIntegers()
    .pluck()
    .get("schema_version");
  const schemaName = db
    .prepare(`SELECT value FROM crsql_master WHERE key = ?`)
    .pluck()
    .get("schema_name");

  const maybeIncompatibleSchma = schemaName != null && schemaName != requestedSchemaName;

  if (maybeIncompatibleSchma) {
    // we will not allow reformatting a db to a new schema for now
    closeDb(db);
    throw new Error(`Server has schema ${schemaName} but client requested ${requestedSchemaName}`);
  }

  if (schemaName == requestedSchemaName && requestedVersion == schemaVersion) {
    return new DBWrapper(db);
  }
  console.log(
    `Mismatch schema version. Requested ${requestedSchemaName} v${requestedVersion} but found ${schemaName} v${schemaVersion}`
  );

  // @todo This is a dependency on having the schema on the local file system.
  // It's a tight coupling of the sync server to the app that needs syncing. Not
  // unreasonable, but if I continue with this I should move them into the same
  // repo.
  const content = await fs.promises.readFile(getSchemaPath(requestedSchemaName), "utf-8");
  const residentVersion = cryb64(content);
  if (residentVersion != requestedVersion) {
    closeDb(db);
    throw new Error(
      `Server has schema version ${residentVersion} but client requested ${requestedVersion}`
    );
  }

  // upgrade the server to the requested version which is on disk
  db.transaction(() => {
    db.prepare(`SELECT crsql_automigrate(?)`).run(content);
    db.prepare(`INSERT OR REPLACE INTO crsql_master (key, value) VALUES (?, ?)`).run(
      "schema_version",
      requestedVersion
    );
    db.prepare(`INSERT OR REPLACE INTO crsql_master (key, value) VALUES (?, ?)`).run(
      "schema_name",
      requestedSchemaName
    );
  })();

  return new DBWrapper(db);
}

function closeDb(db: Database.Database) {
  db.prepare(`SELECT crsql_finalize()`).run();
  db.close();
}

function getDbPath(dbName: string) {
  if (hasPathParts(dbName)) {
    throw new Error(`${dbName} must not include '..', '/', or '\\'`);
  }

  return path.join(DB_FOLDER, dbName + ".db");
}

function getSchemaPath(schemaName: string) {
  if (hasPathParts(schemaName)) {
    throw new Error(`${schemaName} must not include '..', '/', or '\\'`);
  }

  return path.join(SCHEMA_FOLDER, schemaName);
}

function hasPathParts(s: string) {
  return s.includes("..") || s.includes("/") || s.includes("\\") || s.includes("service-db");
}
