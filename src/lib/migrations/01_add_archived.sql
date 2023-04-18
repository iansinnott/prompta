SELECT
  crsql_begin_alter ('thread');

ALTER TABLE "thread"
ADD COLUMN "archived" BOOLEAN DEFAULT FALSE;

SELECT
  crsql_commit_alter ('thread');

-- Make sure to update the version! Otherwise this will be run again
PRAGMA user_version = 1;