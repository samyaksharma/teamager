-- Add ownerId to documents table and populate it with createdBy
ALTER TABLE "document" ADD COLUMN IF NOT EXISTS "owner_id" uuid;

-- Update existing documents to set ownerId = createdBy
UPDATE "document" SET "owner_id" = "created_by" WHERE "owner_id" IS NULL;

-- Make ownerId NOT NULL after populating
ALTER TABLE "document" ALTER COLUMN "owner_id" SET NOT NULL;

-- Add foreign key constraint
ALTER TABLE "document" ADD CONSTRAINT "document_owner_id_users_id_fk" 
FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE;

-- Create document_roles table
CREATE TABLE IF NOT EXISTS "document_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"user_id" uuid,
	"team_id" uuid,
	"role" varchar(50) NOT NULL,
	CONSTRAINT "document_roles_document_id_user_id_unique" UNIQUE("document_id","user_id"),
	CONSTRAINT "document_roles_document_id_team_id_unique" UNIQUE("document_id","team_id")
);

-- Add foreign key constraints for document_roles
ALTER TABLE "document_roles" ADD CONSTRAINT "document_roles_document_id_document_id_fk" 
FOREIGN KEY ("document_id") REFERENCES "document"("id") ON DELETE CASCADE;

ALTER TABLE "document_roles" ADD CONSTRAINT "document_roles_user_id_users_id_fk" 
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;

ALTER TABLE "document_roles" ADD CONSTRAINT "document_roles_team_id_team_id_fk" 
FOREIGN KEY ("team_id") REFERENCES "team"("id") ON DELETE CASCADE;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "document_owner_id_idx" ON "document"("owner_id");
CREATE INDEX IF NOT EXISTS "document_roles_document_id_idx" ON "document_roles"("document_id");
CREATE INDEX IF NOT EXISTS "document_roles_user_id_idx" ON "document_roles"("user_id");
CREATE INDEX IF NOT EXISTS "document_roles_team_id_idx" ON "document_roles"("team_id");