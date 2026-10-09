CREATE TABLE IF NOT EXISTS "notification" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "actor_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "module" varchar(32) NOT NULL,
  "type" varchar(64) NOT NULL,
  "title" varchar(255) NOT NULL,
  "body" text,
  "link" varchar(512),
  "read_at" timestamp,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "notification_user_created_idx" ON "notification" ("user_id", "created_at");

CREATE TABLE IF NOT EXISTS "notification_setting" (
  "user_id" uuid PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "documents" boolean NOT NULL DEFAULT true,
  "tasks" boolean NOT NULL DEFAULT true,
  "messages" boolean NOT NULL DEFAULT true
);
