# Enum Migration Guide

This guide will help you safely migrate from the current string-based roles/statuses to a robust integer-based enum system.

## 🚨 IMPORTANT: Follow these steps in order

### Step 1: Backup your database
```bash
# Create a backup before starting
pg_dump your_database_name > backup_before_enum_migration.sql
```

### Step 2: Temporarily revert schema changes
```bash
# Replace the current schema.ts with the transition schema
cp temp-schema-revert.ts src/db/schema.ts
```

### Step 3: Generate and run the migration
```bash
# Generate the migration that adds new columns
npx drizzle-kit generate:pg

# Apply the migration
npx drizzle-kit push:pg
```

### Step 4: Run the data conversion script
```bash
# This will populate the new integer columns with converted data
psql your_database_name < safe-enum-migration.sql
```

### Step 5: Apply the final schema
```bash
# Replace with the final enum schema
cp src/types/enums.ts temp-backup-enums.ts  # backup the enums
# Then manually update schema.ts to use the enum imports from the original schema
```

### Step 6: Generate final migration
```bash
# This will drop the old varchar columns and rename the integer columns
npx drizzle-kit generate:pg
npx drizzle-kit push:pg
```

## Alternative: Manual Database Migration

If you prefer to run the migration manually (recommended for production):

### 1. Add new columns:
```sql
-- Add new integer columns
ALTER TABLE organization_users ADD COLUMN role_int INTEGER;
ALTER TABLE organization_invitation ADD COLUMN role_int INTEGER;
ALTER TABLE team_users ADD COLUMN role_int INTEGER; 
ALTER TABLE document_roles ADD COLUMN role_int INTEGER;
ALTER TABLE users ADD COLUMN status INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE organization_invitation ADD COLUMN status INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE task ADD COLUMN type INTEGER DEFAULT 0 NOT NULL;
```

### 2. Convert existing data:
```sql
-- Convert roles to integers
UPDATE organization_users SET role_int = CASE 
    WHEN role = 'owner' THEN 2
    WHEN role = 'admin' THEN 1  
    WHEN role = 'member' THEN 0
    ELSE 0 END;

-- (Continue with other conversions from safe-enum-migration.sql)
```

### 3. Verify data integrity:
```sql
-- Check that all conversions worked
SELECT role, role_int, COUNT(*) FROM organization_users GROUP BY role, role_int;
```

### 4. Drop old columns and rename new ones:
```sql
-- Drop old varchar columns
ALTER TABLE organization_users DROP COLUMN role;
ALTER TABLE organization_users RENAME COLUMN role_int TO role;
ALTER TABLE organization_users ALTER COLUMN role SET NOT NULL;
ALTER TABLE organization_users ALTER COLUMN role SET DEFAULT 0;
```

## Benefits of the New System

### Before (Inconsistent):
```javascript
// Mixed types everywhere
task.priority = 2 or 'high'
task.status = 0 or 'todo' or 'backlog'
user.role = 'admin' or 'member'
```

### After (Consistent):
```javascript
// All integers with clear enums
task.priority = TaskPriority.HIGH  // 2
task.status = TaskStatus.IN_PROGRESS  // 2
user.role = OrganizationRole.ADMIN  // 1
```

## Enum Values Reference

| Enum | Value | Label |
|------|-------|--------|
| **TaskPriority** | 0 | Low |
| | 1 | Medium |
| | 2 | High |
| | 3 | Critical |
| **TaskStatus** | 0 | Backlog |
| | 1 | To Do |
| | 2 | In Progress |
| | 3 | In Review |
| | 4 | Done |
| | 5 | Cancelled |
| **OrganizationRole** | 0 | Member |
| | 1 | Admin |  
| | 2 | Owner |
| **TeamRole** | 0 | Member |
| | 1 | Contributor |
| | 2 | Lead |
| **DocumentRole** | 0 | Viewer |
| | 1 | Commenter |
| | 2 | Editor |
| | 3 | Admin |

## Rollback Plan

If something goes wrong, you can rollback:

```bash
# Restore from backup
psql your_database_name < backup_before_enum_migration.sql

# Revert schema changes
git checkout HEAD~1 src/db/schema.ts
```

## Testing

After migration, test these key areas:
- [ ] User registration and role assignment
- [ ] Task creation with priorities and statuses  
- [ ] Team member role changes
- [ ] Document permission changes
- [ ] Frontend enum dropdowns
- [ ] API responses with new integer values

## Verification Queries

```sql
-- Check role distributions
SELECT 'org_users' as table_name, role, COUNT(*) FROM organization_users GROUP BY role
UNION ALL
SELECT 'team_users' as table_name, role, COUNT(*) FROM team_users GROUP BY role;

-- Check task distributions  
SELECT 'task_status' as type, status as value, COUNT(*) FROM task GROUP BY status
UNION ALL
SELECT 'task_priority' as type, priority as value, COUNT(*) FROM task GROUP BY priority;

-- Verify enum reference table
SELECT * FROM enum_reference ORDER BY enum_type, enum_value;
```