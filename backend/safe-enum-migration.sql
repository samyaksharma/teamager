-- Safe Migration to Enum System
-- This migration preserves existing data while converting to integer enums

BEGIN;

-- =============================================================================
-- STEP 1: ADD NEW INTEGER COLUMNS
-- =============================================================================

-- Add new integer role columns alongside existing varchar columns
ALTER TABLE organization_users ADD COLUMN role_int INTEGER;
ALTER TABLE organization_invitation ADD COLUMN role_int INTEGER;
ALTER TABLE team_users ADD COLUMN role_int INTEGER;
ALTER TABLE document_roles ADD COLUMN role_int INTEGER;

-- Add new status columns
ALTER TABLE users ADD COLUMN status INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE organization_invitation ADD COLUMN status INTEGER DEFAULT 0 NOT NULL;

-- Add new task columns
ALTER TABLE task ADD COLUMN type INTEGER DEFAULT 0 NOT NULL;

-- =============================================================================
-- STEP 2: POPULATE NEW COLUMNS WITH CONVERTED DATA
-- =============================================================================

-- Convert organization_users roles
UPDATE organization_users SET role_int = CASE 
    WHEN role = 'owner' THEN 2
    WHEN role = 'admin' THEN 1
    WHEN role = 'member' THEN 0
    ELSE 0
END;

-- Convert organization_invitation roles  
UPDATE organization_invitation SET role_int = CASE 
    WHEN role = 'owner' THEN 2
    WHEN role = 'admin' THEN 1
    WHEN role = 'member' THEN 0
    ELSE 0
END;

-- Convert team_users roles
UPDATE team_users SET role_int = CASE 
    WHEN role = 'lead' THEN 2
    WHEN role = 'contributor' THEN 1
    WHEN role = 'member' THEN 0
    ELSE 0
END;

-- Convert document_roles roles
UPDATE document_roles SET role_int = CASE 
    WHEN role = 'admin' THEN 3
    WHEN role = 'editor' THEN 2
    WHEN role = 'commenter' THEN 1
    WHEN role = 'viewer' THEN 0
    ELSE 0
END;

-- Set user status based on email verification
UPDATE users SET status = CASE 
    WHEN email_verified = true THEN 1  -- ACTIVE
    ELSE 0  -- PENDING
END;

-- Set invitation status
UPDATE organization_invitation SET status = CASE 
    WHEN accepted = true THEN 1  -- ACCEPTED
    WHEN deleted_at IS NOT NULL THEN 4  -- CANCELLED
    WHEN expires_at < NOW() THEN 3  -- EXPIRED
    ELSE 0  -- PENDING
END;

-- Update task status values (shift existing values to new enum)
UPDATE task SET status = CASE
    WHEN status = 2 THEN 4  -- done -> DONE
    WHEN status = 1 THEN 2  -- in progress -> IN_PROGRESS  
    WHEN status = 0 THEN 0  -- todo -> BACKLOG
    ELSE status
END;

-- =============================================================================
-- STEP 3: VERIFY DATA INTEGRITY
-- =============================================================================

-- Check for any NULL values that shouldn't exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM organization_users WHERE role_int IS NULL) THEN
        RAISE EXCEPTION 'Found NULL role_int values in organization_users';
    END IF;
    
    IF EXISTS (SELECT 1 FROM team_users WHERE role_int IS NULL) THEN
        RAISE EXCEPTION 'Found NULL role_int values in team_users';
    END IF;
    
    IF EXISTS (SELECT 1 FROM document_roles WHERE role_int IS NULL) THEN
        RAISE EXCEPTION 'Found NULL role_int values in document_roles';
    END IF;
    
    IF EXISTS (SELECT 1 FROM organization_invitation WHERE role_int IS NULL) THEN
        RAISE EXCEPTION 'Found NULL role_int values in organization_invitation';
    END IF;
END $$;

-- =============================================================================
-- STEP 4: DROP OLD COLUMNS AND RENAME NEW ONES
-- =============================================================================

-- organization_users table
ALTER TABLE organization_users DROP COLUMN role;
ALTER TABLE organization_users RENAME COLUMN role_int TO role;
ALTER TABLE organization_users ALTER COLUMN role SET NOT NULL;
ALTER TABLE organization_users ALTER COLUMN role SET DEFAULT 0;

-- organization_invitation table  
ALTER TABLE organization_invitation DROP COLUMN role;
ALTER TABLE organization_invitation DROP COLUMN accepted;
ALTER TABLE organization_invitation RENAME COLUMN role_int TO role;
ALTER TABLE organization_invitation ALTER COLUMN role SET NOT NULL;
ALTER TABLE organization_invitation ALTER COLUMN role SET DEFAULT 0;

-- team_users table
ALTER TABLE team_users DROP COLUMN role;
ALTER TABLE team_users RENAME COLUMN role_int TO role;
ALTER TABLE team_users ALTER COLUMN role SET NOT NULL;
ALTER TABLE team_users ALTER COLUMN role SET DEFAULT 0;

-- document_roles table
ALTER TABLE document_roles DROP COLUMN role;
ALTER TABLE document_roles RENAME COLUMN role_int TO role;
ALTER TABLE document_roles ALTER COLUMN role SET NOT NULL;

-- =============================================================================
-- STEP 5: CREATE ENUM REFERENCE TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS enum_reference (
    id SERIAL PRIMARY KEY,
    enum_type VARCHAR(50) NOT NULL,
    enum_value INTEGER NOT NULL,
    enum_label VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(enum_type, enum_value)
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
('InvitationStatus', 4, 'Cancelled', 'Invitation cancelled')
ON CONFLICT (enum_type, enum_value) DO NOTHING;

COMMIT;

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Check role distributions
SELECT 'organization_users' as table_name, role, COUNT(*) as count FROM organization_users GROUP BY role
UNION ALL
SELECT 'team_users' as table_name, role, COUNT(*) as count FROM team_users GROUP BY role  
UNION ALL
SELECT 'document_roles' as table_name, role, COUNT(*) as count FROM document_roles GROUP BY role
UNION ALL
SELECT 'organization_invitation' as table_name, role, COUNT(*) as count FROM organization_invitation GROUP BY role
ORDER BY table_name, role;

-- Check status distributions
SELECT 'users' as table_name, status, COUNT(*) as count FROM users GROUP BY status
UNION ALL  
SELECT 'organization_invitation' as table_name, status, COUNT(*) as count FROM organization_invitation GROUP BY status
ORDER BY table_name, status;

-- Check task distributions
SELECT 'task_status' as table_name, status as value, COUNT(*) as count FROM task GROUP BY status
UNION ALL
SELECT 'task_priority' as table_name, priority as value, COUNT(*) as count FROM task GROUP BY priority  
UNION ALL
SELECT 'task_type' as table_name, type as value, COUNT(*) as count FROM task GROUP BY type
ORDER BY table_name, value;