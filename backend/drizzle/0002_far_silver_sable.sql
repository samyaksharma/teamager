CREATE TABLE IF NOT EXISTS "document_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"user_id" uuid,
	"team_id" uuid,
	"role" varchar(50) NOT NULL,
	CONSTRAINT "document_roles_document_id_user_id_unique" UNIQUE("document_id","user_id"),
	CONSTRAINT "document_roles_document_id_team_id_unique" UNIQUE("document_id","team_id")
);
--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "owner_id" uuid NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "document" ADD CONSTRAINT "document_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "document_roles" ADD CONSTRAINT "document_roles_document_id_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "document"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "document_roles" ADD CONSTRAINT "document_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "document_roles" ADD CONSTRAINT "document_roles_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "team"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
