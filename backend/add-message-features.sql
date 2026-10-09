ALTER TABLE "message" ADD COLUMN IF NOT EXISTS "pinned_at" timestamp;
ALTER TABLE "message" ADD COLUMN IF NOT EXISTS "pinned_by" uuid REFERENCES "users"("id") ON DELETE SET NULL;

-- Threads, task-from-message, reactions
ALTER TABLE "message" ADD COLUMN IF NOT EXISTS "parent_id" uuid REFERENCES "message"("id") ON DELETE CASCADE;
ALTER TABLE "message" ADD COLUMN IF NOT EXISTS "task_id" uuid REFERENCES "task"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "message_parent_id_idx" ON "message" ("parent_id");

CREATE TABLE IF NOT EXISTS "message_reaction" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "message_id" uuid NOT NULL REFERENCES "message"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "emoji" varchar(32) NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  UNIQUE ("message_id", "user_id", "emoji")
);
