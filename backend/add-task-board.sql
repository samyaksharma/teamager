ALTER TABLE "task" ADD COLUMN IF NOT EXISTS "position" integer;

CREATE TABLE IF NOT EXISTS "task_saved_view" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "name" varchar(80) NOT NULL,
  "filters" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  UNIQUE ("user_id", "name")
);
