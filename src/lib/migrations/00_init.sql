CREATE TABLE
  if NOT EXISTS "thread" (
    "id" VARCHAR(255) PRIMARY KEY, -- Key should be supplied by user. nanoid, uuid, etc
    "title" VARCHAR(255),
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

SELECT
  crsql_as_crr ('thread');

CREATE TABLE
  if NOT EXISTS "message" (
    "id" VARCHAR(255) PRIMARY KEY,
    "role" VARCHAR(63) NOT NULL DEFAULT '',
    "model" VARCHAR(255),
    "cancelled" BOOLEAN DEFAULT FALSE,
    "content" TEXT,
    "thread_id" VARCHAR(255),
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

SELECT
  crsql_as_crr ('message');

CREATE INDEX if NOT EXISTS messagethreadidx ON "message" ("thread_id");

CREATE TABLE
  if NOT EXISTS "preferences" ("key" VARCHAR(255) PRIMARY KEY, "value" TEXT);

CREATE TABLE
  if NOT EXISTS "deleted_record" (
    "id" VARCHAR(255) PRIMARY KEY,
    "table_name" VARCHAR(255),
    "deleted_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data" JSON NOT NULL DEFAULT '{}'
  );

SELECT
  crsql_as_crr ('deleted_record');