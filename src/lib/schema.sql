CREATE TABLE
  if NOT EXISTS "thread" (
    "id" VARCHAR(255) PRIMARY KEY, -- Key should be supplied by user. nanoid, uuid, etc
    "title" VARCHAR(255),
    "created_at" TIMESTAMMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

-- SELECT
--   crsql_as_crr ('thread');
CREATE TABLE
  if NOT EXISTS "message" (
    "id" VARCHAR(255) PRIMARY KEY,
    "role" VARCHAR(63) NOT NULL, -- system, user, assistant
    "model" VARCHAR(255), -- Only applicable for role=assistant
    "cancelled" BOOLEAN DEFAULT FALSE,
    "content" TEXT,
    "thread_id" VARCHAR(255),
    "created_at" TIMESTAMMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

-- SELECT
--   crsql_as_crr ('message');
CREATE INDEX if NOT EXISTS messagethreadidx ON "message" ("thread_id");

CREATE TABLE
  if NOT EXISTS "preferences" ("key" VARCHAR(255) PRIMARY KEY, "value" TEXT);

-- SELECT
--   crsql_as_crr ('preferences');
--
-- BEGIN TRANSACTION;
--   CREATE TEMPORARY TABLE temp_table AS SELECT * FROM "message";
--   DROP TABLE "message";
--   CREATE TABLE "message" (
--       column_definition1,
--       column_definition2,
--       ...
--       column_definition_without_fk
--   );
--   INSERT INTO "message" SELECT * FROM temp_table;
--   DROP TABLE temp_table;
-- COMMIT;