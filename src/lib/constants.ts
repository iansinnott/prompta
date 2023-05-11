/**
 * A record of the databases we expect to be accessible to the app. Although
 * clearly not enforced, this list should be treated as append-only. This does
 * not mean the db version can't be moved backwards, just do so by appending.
 *
 * Appending a new db name effectively resets the db, without data loss since
 * you can change it back. This is good for testing as if on a new system.
 */
export const DB_NAMES = [
  "chat_db-v1",
  "chat_db-v2",
  "chat_db-v3",
  "chat_db-v4",
  "chat_db-v5",
  "chat_db-v8.1",
  "chat_db-v8.2", // Testing out migration fixes
  "chat_db-v8.1", // Moving back to 8.1 now that migrations are fixed. No data changed, just migration code
  "chat_db-v9.1", // Starting fresh in dev
  "chat_db-v9.2", // QA importing
  "chat_db-v10", // Corrupted db
  "chat_db-v10.1", // Testing syncing
  "chat_db-v11", // fts
  "chat_db-v11.11", // fts
];

export const DB_NAME = DB_NAMES.at(-1);
