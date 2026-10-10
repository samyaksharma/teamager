CREATE TABLE IF NOT EXISTS "task_link" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "task_id" uuid NOT NULL REFERENCES "task"("id") ON DELETE CASCADE,
  "url" varchar(2048) NOT NULL,
  "provider" varchar(16) NOT NULL,
  "kind" varchar(16) NOT NULL,
  "label" varchar(255) NOT NULL,
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  UNIQUE ("task_id", "url")
);

CREATE TABLE IF NOT EXISTS "calendar_feed_token" (
  "user_id" uuid PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "token" varchar(64) NOT NULL UNIQUE,
  "created_at" timestamp NOT NULL DEFAULT now()
);
