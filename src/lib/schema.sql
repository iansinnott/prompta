CREATE TABLE
  if NOT EXISTS "message" (
    "id" INTEGER PRIMARY key AUTOINCREMENT,
    "role" VARCHAR(63) NOT NULL, -- system, user, assistant
    "content" TEXT,
    "thread_id" INTEGER REFERENCES "thread",
    "created_at" TIMESTAMMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

CREATE INDEX if NOT EXISTS messagethreadidx ON "message" ("thread_id");

CREATE TABLE
  if NOT EXISTS "thread" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "title" VARCHAR(255),
    "created_at" TIMESTAMMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

CREATE TABLE
  if NOT EXISTS "preferences" ("key" VARCHAR(255) PRIMARY KEY, "value" TEXT);