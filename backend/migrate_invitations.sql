-- Migration: Convert team invitations to organization invitations
-- This script will:
-- 1. Drop team_invitation table (after backing up any important data)
-- 2. Create organization_invitation table
-- 3. Update team_users roles to use string values

-- First, create the organization_invitation table
CREATE TABLE IF NOT EXISTS "organization_invitation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"invited_by" uuid NOT NULL,
	"token" varchar(255) NOT NULL UNIQUE,
	"role" varchar(50) DEFAULT 'member' NOT NULL,
	"department" varchar(64),
	"job_title" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"accepted" boolean DEFAULT false,
	"deleted_at" timestamp,
	"deleted_by" uuid
);

-- Add foreign key constraints for organization_invitation
ALTER TABLE "organization_invitation" ADD CONSTRAINT "organization_invitation_organization_id_organization_id_fk" 
FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;

ALTER TABLE "organization_invitation" ADD CONSTRAINT "organization_invitation_invited_by_users_id_fk" 
FOREIGN KEY ("invited_by") REFERENCES "users"("id") ON DELETE NO ACTION;

ALTER TABLE "organization_invitation" ADD CONSTRAINT "organization_invitation_deleted_by_users_id_fk" 
FOREIGN KEY ("deleted_by") REFERENCES "users"("id") ON DELETE NO ACTION;

-- Drop the team_invitation table (we're moving to org-level invites)
DROP TABLE IF EXISTS "team_invitation" CASCADE;

-- Update team_users table to use string roles instead of numeric
-- First, let's see what roles exist and create a mapping
-- 0 -> 'lead', 1 -> 'member', 2 -> 'contributor'

-- Add a temporary column for new role values
ALTER TABLE "team_users" ADD COLUMN "new_role" varchar(50);

-- Update the new role column based on existing numeric values
UPDATE "team_users" SET "new_role" = CASE 
    WHEN "role" = '0' THEN 'lead'
    WHEN "role" = '1' THEN 'member'  
    WHEN "role" = '2' THEN 'contributor'
    ELSE 'member'
END;

-- Drop the old role column and rename the new one
ALTER TABLE "team_users" DROP COLUMN "role";
ALTER TABLE "team_users" RENAME COLUMN "new_role" TO "role";

-- Set default value for role
ALTER TABLE "team_users" ALTER COLUMN "role" SET DEFAULT 'member';
ALTER TABLE "team_users" ALTER COLUMN "role" SET NOT NULL;