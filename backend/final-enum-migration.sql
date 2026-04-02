-- Final migration step: Drop old columns and rename new ones
-- This completes the enum migration process

BEGIN;

-- =============================================================================
-- STEP 1: DROP OLD VARCHAR COLUMNS AND RENAME INTEGER COLUMNS
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
-- STEP 2: CREATE ENUM REFERENCE TABLE (if not exists)
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

-- Check final schema
\d organization_users
\d team_users  
\d document_roles
\d organization_invitation

-- Check data integrity
SELECT 'organization_users' as table_name, role, COUNT(*) as count FROM organization_users GROUP BY role
UNION ALL
SELECT 'team_users' as table_name, role, COUNT(*) as count FROM team_users GROUP BY role  
UNION ALL
SELECT 'document_roles' as table_name, role, COUNT(*) as count FROM document_roles GROUP BY role
UNION ALL
SELECT 'organization_invitation' as table_name, role, COUNT(*) as count FROM organization_invitation GROUP BY role
ORDER BY table_name, role;

-- Verify enum reference table
SELECT * FROM enum_reference ORDER BY enum_type, enum_value;