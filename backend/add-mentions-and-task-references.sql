CREATE TABLE IF NOT EXISTS "message_mention" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "message_id" uuid NOT NULL REFERENCES "message"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" timestamp NOT NULL DEFAULT now(),
  UNIQUE ("message_id", "user_id")
);

CREATE TABLE IF NOT EXISTS "task_reference" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "task_id" uuid NOT NULL REFERENCES "task"("id") ON DELETE CASCADE,
  "kind" varchar(16) NOT NULL,
  "target_id" uuid NOT NULL,
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  UNIQUE ("task_id", "kind", "target_id")
);
CREATE INDEX IF NOT EXISTS "task_reference_target_idx" ON "task_reference" ("kind", "target_id");

-- Tasks created from a message are linked to it
INSERT INTO "task_reference" ("task_id", "kind", "target_id", "created_by")
SELECT m."task_id", 'message', m."id", m."user_id" FROM "message" m WHERE m."task_id" IS NOT NULL
ON CONFLICT DO NOTHING;
