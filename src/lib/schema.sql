CREATE TABLE
  if NOT EXISTS "thread" (
    "id" VARCHAR(255) PRIMARY KEY, -- Key should be supplied by user. nanoid, uuid, etc
    "title" VARCHAR(255),
    "created_at" TIMESTAMMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

CREATE TABLE
  if NOT EXISTS "message" (
    "id" VARCHAR(255) PRIMARY KEY,
    "role" VARCHAR(63) NOT NULL, -- system, user, assistant
    "model" VARCHAR(255), -- Only applicable for role=assistant
    "content" TEXT,
    "thread_id" VARCHAR(255) REFERENCES "thread",
    "created_at" TIMESTAMMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

CREATE INDEX if NOT EXISTS messagethreadidx ON "message" ("thread_id");

CREATE TABLE
  if NOT EXISTS "preferences" ("key" VARCHAR(255) PRIMARY KEY, "value" TEXT);