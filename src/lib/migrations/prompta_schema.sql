--
-- The unified schema. Modify this schema as needed. The auto migration will be run by VLCN.
--

CREATE TABLE
  if NOT EXISTS "thread" (
    "id" VARCHAR(255) PRIMARY KEY NOT NULL, -- Key should be supplied by user. nanoid, uuid, etc
    "title" VARCHAR(255),
    "archived" BOOLEAN DEFAULT FALSE,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

SELECT crsql_as_crr ('thread');

CREATE TABLE
  if NOT EXISTS "message" (
    "id" VARCHAR(255) PRIMARY KEY NOT NULL,
    "role" VARCHAR(63) NOT NULL DEFAULT '',
    "model" VARCHAR(255),
    "cancelled" BOOLEAN DEFAULT FALSE,
    "content" TEXT,
    "thread_id" VARCHAR(255),
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

SELECT crsql_as_crr ('message');

CREATE INDEX if NOT EXISTS messagethreadidx ON "message" ("thread_id");

CREATE TABLE
  if NOT EXISTS "preferences" ("key" VARCHAR(255) PRIMARY KEY, "value" TEXT);

CREATE TABLE
  if NOT EXISTS "deleted_record" (
    "id" VARCHAR(255) PRIMARY KEY NOT NULL,
    "table_name" VARCHAR(255),
    "deleted_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data" JSON NOT NULL DEFAULT '{}'
  );

SELECT crsql_as_crr ('deleted_record');

-- Make sure to update the version! Otherwise this will be run again
CREATE TABLE
  if NOT EXISTS "fragment" (
    "id" INTEGER PRIMARY KEY NOT NULL, -- auto increment doesn't work well for synced tables. also, must be int for use in fts rowid
    "entity_id" VARCHAR(255), -- references some other thing in the db. for now, either a thread or a message
    "entity_type" VARCHAR(255), -- what table this belongs to. not quite using sql the way it was intended here
    "attribute" VARCHAR(255), -- the name of the attribute that this fragment is for
    "value" TEXT, -- the value of the attribute that this fragment is for
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

CREATE VIRTUAL TABLE if NOT EXISTS "fragment_fts" USING fts5 (
  "entity_id" UNINDEXED,
  "entity_type" UNINDEXED,
  "attribute",
  "value",
  "created_at" UNINDEXED,
  content = "fragment",
  content_rowid = "id",
  tokenize = "trigram"
);

CREATE TRIGGER if NOT EXISTS "fragment_ai" AFTER INSERT ON "fragment" BEGIN
INSERT INTO
  "fragment_fts" (
    "rowid",
    "entity_id",
    "entity_type",
    "attribute",
    "value",
    "created_at"
  )
VALUES
  (
    NEW."id",
    NEW."entity_id",
    NEW."entity_type",
    NEW."attribute",
    NEW."value",
    NEW."created_at"
  );

END;

CREATE TRIGGER if NOT EXISTS "fragment_ad" AFTER DELETE ON "fragment" BEGIN
INSERT INTO
  "fragment_fts" (
    "fragment_fts",
    "rowid",
    "entity_id",
    "entity_type",
    "attribute",
    "value",
    "created_at"
  )
VALUES
  (
    'delete',
    OLD."id",
    OLD."entity_id",
    OLD."entity_type",
    OLD."attribute",
    OLD."value",
    OLD."created_at"
  );

END;

CREATE TRIGGER if NOT EXISTS "fragment_au" AFTER
UPDATE ON "fragment" BEGIN
INSERT INTO
  "fragment_fts" (
    "fragment_fts",
    "rowid",
    "entity_id",
    "entity_type",
    "attribute",
    "value",
    "created_at"
  )
VALUES
  (
    'delete',
    OLD."id",
    OLD."entity_id",
    OLD."entity_type",
    OLD."attribute",
    OLD."value",
    OLD."created_at"
  );

INSERT INTO
  "fragment_fts" (
    "rowid",
    "entity_id",
    "entity_type",
    "attribute",
    "value",
    "created_at"
  )
VALUES
  (
    NEW."id",
    NEW."entity_id",
    NEW."entity_type",
    NEW."attribute",
    NEW."value",
    NEW."created_at"
  );

END;