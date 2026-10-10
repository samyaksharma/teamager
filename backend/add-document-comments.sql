ALTER TABLE "document_comment" ADD COLUMN IF NOT EXISTS "parent_id" uuid REFERENCES "document_comment"("id") ON DELETE CASCADE;
ALTER TABLE "document_comment" ADD COLUMN IF NOT EXISTS "quote" text;
ALTER TABLE "document_comment" ADD COLUMN IF NOT EXISTS "kind" varchar(16) NOT NULL DEFAULT 'comment';
ALTER TABLE "document_comment" ADD COLUMN IF NOT EXISTS "suggestion" text;
ALTER TABLE "document_comment" ADD COLUMN IF NOT EXISTS "status" varchar(16) NOT NULL DEFAULT 'open';
ALTER TABLE "document_comment" ADD COLUMN IF NOT EXISTS "resolved_by" uuid REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "document_comment" ADD COLUMN IF NOT EXISTS "resolved_at" timestamp;
CREATE INDEX IF NOT EXISTS "document_comment_doc_idx" ON "document_comment" ("document_id", "created_at");
