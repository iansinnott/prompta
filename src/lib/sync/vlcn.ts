import { type DBAsync, type StmtAsync, firstPick } from "@vlcn.io/xplat-api";
import { encode, decode, tags, bytesToHex } from "@vlcn.io/ws-common";
import { dev } from "$app/environment";
import type { toast } from "$lib/toast";

type Args = Readonly<{
  db: DBAsync;
  endpoint: string;
  room: string;
  schemaName: string;
  schemaVersion: bigint;
  pullChangesetStmt: StmtAsync;
  applyChangesetStmt: StmtAsync;
  siteId: Uint8Array;
  notify?: typeof toast;
}>;

export class Syncer {
  readonly #args: Args;
  readonly #syncEndpoint: string;
  #storageKey: string;

  constructor(args: Args) {
    this.#args = args;
    this.#syncEndpoint = `${this.#args.endpoint}/${this.#args.room}?schemaName=${
      this.#args.schemaName
    }&schemaVersion=${this.#args.schemaVersion}`;
    this.#storageKey = `${this.#args.db.siteid}-last-sent-to-${this.#args.endpoint}-${
      this.#args.room
    }`;
  }

  async resetSyncState() {
    localStorage.removeItem(this.#storageKey);
  }

  async pushChanges({ suppressNotification = true } = {}) {
    // track what we last sent to the server so we only send the diff.
    const lastSentVersion = BigInt(localStorage.getItem(this.#storageKey) ?? "0");

    console.log(`Last sent version: ${lastSentVersion}`);

    // gather our changes to send to the server
    const changes = await this.#args.pullChangesetStmt.all(null, lastSentVersion);
    if (changes.length == 0) {
      console.log("No changes to send");
      return;
    }

    const encoded = encode({
      _tag: tags.Changes,
      changes,
      sender: this.#args.siteId,
      since: [lastSentVersion, 0],
    });

    console.log(`Sending ${changes.length} changes since ${lastSentVersion}`);

    if (changes.length && !suppressNotification) {
      this.#args.notify?.({
        title: "Syncing",
        message: `Sending ${changes.length} changes since ${lastSentVersion}`,
        type: "info",
      });
    }

    const response = await fetch(this.#syncEndpoint, {
      method: "POST",
      body: encoded,
      headers: {
        "Content-Type": "application/octet-stream",
      },
    });
    // Record that we've sent up to the given db version to the server
    // so next sync will be a delta.
    if (response.ok) {
      localStorage.setItem(
        `${this.#args.db.siteid}-last-sent-to-${this.#args.endpoint}-${this.#args.room}`,
        changes[changes.length - 1][5].toString(10)
      );
    } else {
      const txt = await response.json();
      throw new Error(txt.message || txt);
    }

    return changes.length;
  }

  async pullChanges({ suppressNotification = true } = {}) {
    const lastSeenVersion = BigInt(
      localStorage.getItem(
        `${this.#args.db.siteid}-last-seen-from-${this.#args.endpoint}-${this.#args.room}`
      ) ?? "0"
    );
    const endpoint =
      this.#syncEndpoint +
      `&requestor=${bytesToHex(this.#args.siteId)}&since=${lastSeenVersion.toString(10)}`;

    const response = await fetch(endpoint);
    if (!response.ok) {
      const txt = await response.json();
      throw new Error(txt.message || txt);
    }
    const msg = decode(new Uint8Array(await response.arrayBuffer()));
    if (msg._tag !== tags.Changes) {
      throw new Error(`Expected changes, got ${msg._tag}`);
    }

    if (msg.changes.length == 0) {
      console.log("No changes to apply");
      return;
    }

    if (msg.changes.length && !suppressNotification) {
      this.#args.notify?.({
        title: "Syncing",
        message: `Applying ${msg.changes.length} changes since ${lastSeenVersion}`,
        type: "info",
      });
    }

    await this.#args.db.tx(async (tx) => {
      for (const c of msg.changes) {
        await this.#args.applyChangesetStmt.run(
          tx,
          c[0],
          c[1],
          c[2],
          c[3],
          c[4],
          c[5],
          // record who send us the change
          msg.sender,
          c[7],
          c[8]
        );
      }
    });

    // Record that we've seen up to the given db version from the server
    // so next sync will be a delta.
    localStorage.setItem(
      `${this.#args.db.siteid}-last-seen-from-${this.#args.endpoint}-${this.#args.room}`,
      msg.changes[msg.changes.length - 1][5].toString(10)
    );

    return msg.changes.length;
  }

  destroy() {
    this.#args.applyChangesetStmt.finalize(null);
    this.#args.pullChangesetStmt.finalize(null);
  }
}

export async function createSyncer({
  db,
  endpoint,
  room,
  notify,
}: {
  db: DBAsync;
  endpoint: string;
  room: string;
  notify?: typeof toast;
}) {
  const schemaName = firstPick<string>(
    await db.execA<[string]>(`SELECT value FROM crsql_master WHERE key = 'schema_name'`)
  );
  if (schemaName == null) {
    throw new Error("The database does not have a schema applied.");
  }
  const schemaVersion = BigInt(
    firstPick<number | bigint>(
      await db.execA<[number | bigint]>(
        /*sql*/ `SELECT value FROM crsql_master WHERE key = 'schema_version'`
      )
    ) || -1
  );
  const [pullChangesetStmt, applyChangesetStmt] = await Promise.all([
    // NOTE: commenting this out for now because site_id was not null. Not sure
    // why it would be. Not sure how it ends up working in the demo.
    // db.prepare(/*sql*/ `
    //   SELECT "table", "pk", "cid", "val", "col_version", "db_version", "site_id", "cl", "seq"
    //   FROM crsql_changes
    //   WHERE db_version > ? AND site_id IS NULL
    // `),

    db.prepare(/*sql*/ `
      SELECT "table", "pk", "cid", "val", "col_version", "db_version", "site_id", "cl", "seq" 
      FROM crsql_changes 
      WHERE db_version > ?
    `),
    db.prepare(/*sql*/ `
      INSERT INTO crsql_changes ("table", "pk", "cid", "val", "col_version", "db_version", "site_id", "cl", "seq")
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
  ]);
  pullChangesetStmt.raw(true);
  const siteId = (await db.execA<[Uint8Array]>(`SELECT crsql_site_id()`))[0][0];

  return new Syncer({
    db,
    endpoint,
    room,
    schemaName,
    schemaVersion,
    pullChangesetStmt,
    applyChangesetStmt,
    siteId,
    notify,
  });
}

export const getDefaultEndpoint = () => {
  if (dev) {
    return "http://localhost:8081";
  }

  return `https://prompta-production.up.railway.app`;
};
