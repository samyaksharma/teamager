ALTER TABLE "task" ADD COLUMN IF NOT EXISTS "parent_id" uuid REFERENCES "task"("id") ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS "task_parent_id_idx" ON "task" ("parent_id");

CREATE TABLE IF NOT EXISTS "task_checklist_item" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "task_id" uuid NOT NULL REFERENCES "task"("id") ON DELETE CASCADE,
  "content" varchar(500) NOT NULL,
  "done" boolean NOT NULL DEFAULT false,
  "position" integer NOT NULL DEFAULT 0,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "task_checklist_item_task_idx" ON "task_checklist_item" ("task_id", "position");
