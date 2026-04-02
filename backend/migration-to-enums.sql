-- Migration to convert string roles/statuses to integer enums
-- Run this script to update existing data to the new enum system

BEGIN;

-- ============================================================================
-- UPDATE USERS TABLE
-- ============================================================================

-- Add status column to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS status INTEGER DEFAULT 0 NOT NULL;

-- Set all existing users to ACTIVE (1) if they have verified email, PENDING (0) otherwise
UPDATE users SET status = CASE 
    WHEN email_verified = true THEN 1  -- ACTIVE
    ELSE 0  -- PENDING
END;

-- ============================================================================
-- UPDATE ORGANIZATION_USERS TABLE
-- ============================================================================

-- Add new integer role column
ALTER TABLE organization_users ADD COLUMN role_new INTEGER;

-- Convert string roles to integer roles
UPDATE organization_users SET role_new = CASE 
    WHEN role = 'owner' THEN 2
    WHEN role = 'admin' THEN 1
    WHEN role = 'member' THEN 0
    ELSE 0  -- default to member
END;

-- Drop old role column and rename new one
ALTER TABLE organization_users DROP COLUMN role;
ALTER TABLE organization_users RENAME COLUMN role_new TO role;
ALTER TABLE organization_users ALTER COLUMN role SET NOT NULL;
ALTER TABLE organization_users ALTER COLUMN role SET DEFAULT 0;

-- ============================================================================
-- UPDATE ORGANIZATION_INVITATIONS TABLE
-- ============================================================================

-- Add status column for invitation status
ALTER TABLE organization_invitation ADD COLUMN IF NOT EXISTS status INTEGER DEFAULT 0 NOT NULL;

-- Add new integer role column
ALTER TABLE organization_invitation ADD COLUMN role_new INTEGER;

-- Convert string roles to integer roles
UPDATE organization_invitation SET role_new = CASE 
    WHEN role = 'owner' THEN 2
    WHEN role = 'admin' THEN 1
    WHEN role = 'member' THEN 0
    ELSE 0  -- default to member
END;

-- Set invitation status based on accepted field
UPDATE organization_invitation SET status = CASE 
    WHEN accepted = true THEN 1  -- ACCEPTED
    WHEN deleted_at IS NOT NULL THEN 4  -- CANCELLED
    WHEN expires_at < NOW() THEN 3  -- EXPIRED
    ELSE 0  -- PENDING
END;

-- Drop old columns and rename new ones
ALTER TABLE organization_invitation DROP COLUMN role;
ALTER TABLE organization_invitation DROP COLUMN accepted;
ALTER TABLE organization_invitation RENAME COLUMN role_new TO role;
ALTER TABLE organization_invitation ALTER COLUMN role SET NOT NULL;
ALTER TABLE organization_invitation ALTER COLUMN role SET DEFAULT 0;

-- ============================================================================
-- UPDATE TEAM_USERS TABLE
-- ============================================================================

-- Add new integer role column
ALTER TABLE team_users ADD COLUMN role_new INTEGER;

-- Convert string roles to integer roles
UPDATE team_users SET role_new = CASE 
    WHEN role = 'lead' THEN 2
    WHEN role = 'contributor' THEN 1
    WHEN role = 'member' THEN 0
    ELSE 0  -- default to member
END;

-- Drop old role column and rename new one
ALTER TABLE team_users DROP COLUMN role;
ALTER TABLE team_users RENAME COLUMN role_new TO role;
ALTER TABLE team_users ALTER COLUMN role SET NOT NULL;
ALTER TABLE team_users ALTER COLUMN role SET DEFAULT 0;

-- ============================================================================
-- UPDATE CHANNELS TABLE
-- ============================================================================

-- The type column is already integer, just update the values if needed
-- 0 = TEXT, 1 = VOICE, 2 = ANNOUNCEMENT, 3 = PRIVATE (new)
-- Current: 0 = text, 1 = voice, 2 = announcement
-- No changes needed, values already align

-- ============================================================================
-- UPDATE TASKS TABLE
-- ============================================================================

-- Add type column
ALTER TABLE task ADD COLUMN IF NOT EXISTS type INTEGER DEFAULT 0 NOT NULL;

-- Update existing priority values (they should already be 0,1,2 but let's ensure)
-- 0 = LOW, 1 = MEDIUM, 2 = HIGH, 3 = CRITICAL (new)
-- Current values should already be correct

-- Update status values
-- Current: 0 = todo, 1 = in progress, 2 = done
-- New: 0 = BACKLOG, 1 = TODO, 2 = IN_PROGRESS, 3 = IN_REVIEW, 4 = DONE, 5 = CANCELLED

-- First, shift existing values
UPDATE task SET status = CASE
    WHEN status = 2 THEN 4  -- done -> DONE
    WHEN status = 1 THEN 2  -- in progress -> IN_PROGRESS  
    WHEN status = 0 THEN 0  -- todo -> BACKLOG (we'll treat old 'todo' as backlog)
    ELSE status
END;

-- ============================================================================
-- UPDATE DOCUMENT_ROLES TABLE
-- ============================================================================

-- Add new integer role column
ALTER TABLE document_roles ADD COLUMN role_new INTEGER;

-- Convert string roles to integer roles
UPDATE document_roles SET role_new = CASE 
    WHEN role = 'admin' THEN 3
    WHEN role = 'editor' THEN 2
    WHEN role = 'commenter' THEN 1
    WHEN role = 'viewer' THEN 0
    ELSE 0  -- default to viewer
END;

-- Drop old role column and rename new one
ALTER TABLE document_roles DROP COLUMN role;
ALTER TABLE document_roles RENAME COLUMN role_new TO role;
ALTER TABLE document_roles ALTER COLUMN role SET NOT NULL;

-- ============================================================================
-- CREATE ENUM REFERENCE TABLE (for documentation)
-- ============================================================================

CREATE TABLE IF NOT EXISTS enum_reference (
    id SERIAL PRIMARY KEY,
    enum_type VARCHAR(50) NOT NULL,
    enum_value INTEGER NOT NULL,
    enum_label VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Insert enum reference data
INSERT INTO enum_reference (enum_type, enum_value, enum_label, description) VALUES
-- Task Priority
('TaskPriority', 0, 'Low', 'Low priority task'),
('TaskPriority', 1, 'Medium', 'Medium priority task'),
('TaskPriority', 2, 'High', 'High priority task'),
('TaskPriority', 3, 'Critical', 'Critical priority task'),

-- Task Status  
('TaskStatus', 0, 'Backlog', 'Task in backlog'),
('TaskStatus', 1, 'To Do', 'Task ready to start'),
('TaskStatus', 2, 'In Progress', 'Task being worked on'),
('TaskStatus', 3, 'In Review', 'Task under review'),
('TaskStatus', 4, 'Done', 'Task completed'),
('TaskStatus', 5, 'Cancelled', 'Task cancelled'),

-- Task Type
('TaskType', 0, 'Task', 'General task'),
('TaskType', 1, 'Bug', 'Bug fix'),
('TaskType', 2, 'Feature', 'New feature'),
('TaskType', 3, 'Enhancement', 'Enhancement to existing feature'),
('TaskType', 4, 'Documentation', 'Documentation task'),
('TaskType', 5, 'Epic', 'Large initiative or epic'),

-- Organization Role
('OrganizationRole', 0, 'Member', 'Organization member'),
('OrganizationRole', 1, 'Admin', 'Organization admin'),
('OrganizationRole', 2, 'Owner', 'Organization owner'),

-- Team Role
('TeamRole', 0, 'Member', 'Team member'),
('TeamRole', 1, 'Contributor', 'Team contributor'),
('TeamRole', 2, 'Lead', 'Team lead'),

-- Document Role
('DocumentRole', 0, 'Viewer', 'Can view document'),
('DocumentRole', 1, 'Commenter', 'Can comment on document'),
('DocumentRole', 2, 'Editor', 'Can edit document'),
('DocumentRole', 3, 'Admin', 'Can manage document permissions'),

-- Channel Type
('ChannelType', 0, 'Text', 'Text channel'),
('ChannelType', 1, 'Voice', 'Voice channel'),
('ChannelType', 2, 'Announcement', 'Announcement channel'),
('ChannelType', 3, 'Private', 'Private channel'),

-- User Status
('UserStatus', 0, 'Pending', 'User pending email verification'),
('UserStatus', 1, 'Active', 'Active user'),
('UserStatus', 2, 'Suspended', 'Suspended user'),
('UserStatus', 3, 'Deactivated', 'Deactivated user'),

-- Invitation Status
('InvitationStatus', 0, 'Pending', 'Invitation pending'),
('InvitationStatus', 1, 'Accepted', 'Invitation accepted'),
('InvitationStatus', 2, 'Declined', 'Invitation declined'),
('InvitationStatus', 3, 'Expired', 'Invitation expired'),
('InvitationStatus', 4, 'Cancelled', 'Invitation cancelled');

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES (run these to verify the migration)
-- ============================================================================

/*
-- Check users status distribution
SELECT status, COUNT(*) as count FROM users GROUP BY status;

-- Check organization roles distribution  
SELECT role, COUNT(*) as count FROM organization_users GROUP BY role;

-- Check team roles distribution
SELECT role, COUNT(*) as count FROM team_users GROUP BY role;

-- Check task status distribution
SELECT status, COUNT(*) as count FROM task GROUP BY status;

-- Check task priority distribution
SELECT priority, COUNT(*) as count FROM task GROUP BY priority;

-- Check document roles distribution
SELECT role, COUNT(*) as count FROM document_roles GROUP BY role;

-- Check enum reference table
SELECT * FROM enum_reference ORDER BY enum_type, enum_value;
*/