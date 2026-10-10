// Final schema with enum imports - replaces current schema.ts after migration
import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  boolean,
  serial,
  unique,
  index
} from "drizzle-orm/pg-core"
import { relations, sql } from "drizzle-orm"
import {
  TaskPriority,
  TaskStatus,
  TaskType,
  OrganizationRole,
  TeamRole,
  DocumentRole,
  ChannelType,
  UserStatus,
  InvitationStatus
} from "../types/enums"

// Organizations
export const organizations = pgTable("organization", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  size: varchar("size", { length: 64 }),
  industry: varchar("industry", { length: 128 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
})

// Users
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  username: varchar("username", { length: 64 }).notNull().unique(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  avatarUrl: text("avatar_url"),
  status: integer("status").default(UserStatus.PENDING).notNull().$type<UserStatus>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  emailVerified: boolean("email_verified").default(false).notNull()
})

// Organization membership
export const organizationUsers = pgTable("organization_users", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  role: integer("role").default(OrganizationRole.MEMBER).notNull().$type<OrganizationRole>(),
  department: varchar("department", { length: 64 }),
  jobTitle: varchar("job_title", { length: 100 }),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
  invitedBy: uuid("invited_by").references(() => users.id),
  isActive: boolean("is_active").default(true).notNull()
}, (table) => ({
  userOrgUnique: unique().on(table.userId, table.organizationId)
}))

// Verification tokens
export const verificationTokens = pgTable("verification_tokens", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
})

// Refresh tokens
export const refreshTokens = pgTable("refresh_tokens", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 255 }).notNull().unique(),
  deviceName: varchar("device_name", { length: 255 }),
  deviceType: varchar("device_type", { length: 50 }),
  browser: varchar("browser", { length: 100 }),
  os: varchar("os", { length: 100 }),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  isPrimaryDevice: boolean("is_primary_device").default(false),
  isActive: boolean("is_active").default(true),
  lastUsedAt: timestamp("last_used_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
  revokedAt: timestamp("revoked_at"),
  revokedBy: varchar("revoked_by", { length: 255 }),
  revokeReason: varchar("revoke_reason", { length: 100 })
})

// Teams
export const teams = pgTable("team", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
  deletedBy: uuid("deleted_by").references(() => users.id)
})

// Organization invitations
export const organizationInvitations = pgTable("organization_invitation", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  email: varchar("email", { length: 255 }).notNull(),
  invitedBy: uuid("invited_by")
    .notNull()
    .references(() => users.id),
  token: varchar("token", { length: 255 }).notNull().unique(),
  role: integer("role").default(OrganizationRole.MEMBER).notNull().$type<OrganizationRole>(),
  status: integer("status").default(InvitationStatus.PENDING).notNull().$type<InvitationStatus>(),
  department: varchar("department", { length: 64 }),
  jobTitle: varchar("job_title", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  deletedAt: timestamp("deleted_at"),
  deletedBy: uuid("deleted_by").references(() => users.id)
})

// Team users
export const teamUsers = pgTable("team_users", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  teamId: uuid("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  role: integer("role").default(TeamRole.MEMBER).notNull().$type<TeamRole>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: uuid("created_by").references(() => users.id)
}, (table) => ({
  userTeamUnique: unique().on(table.userId, table.teamId)
}))

// Channels
export const channels = pgTable("channel", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  teamId: uuid("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  type: integer("type").default(ChannelType.TEXT).notNull().$type<ChannelType>(),
  isPrivate: boolean("is_private").default(false),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: uuid("created_by")
    .references(() => users.id)
})

// Messages
export const messages = pgTable("message", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  channelId: uuid("channel_id")
    .notNull()
    .references(() => channels.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  pinnedAt: timestamp("pinned_at"),
  pinnedBy: uuid("pinned_by").references(() => users.id, { onDelete: "set null" }),
  // Thread reply: points at the top-level message being replied to
  parentId: uuid("parent_id"),
  // Task created from this message
  taskId: uuid("task_id").references(() => tasks.id, { onDelete: "set null" })
})

// Message reactions
export const messageReactions = pgTable("message_reaction", {
  id: uuid("id").defaultRandom().primaryKey(),
  messageId: uuid("message_id")
    .notNull()
    .references(() => messages.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  emoji: varchar("emoji", { length: 32 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
}, (table) => ({
  reactionUnique: unique().on(table.messageId, table.userId, table.emoji)
}))

// Direct messages
export const directMessages = pgTable("direct_message", {
  id: uuid("id").defaultRandom().primaryKey(),
  content: text("content").notNull(),
  senderId: uuid("sender_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  receiverId: uuid("receiver_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  readAt: timestamp("read_at"),
  deletedAt: timestamp("deleted_at"),
  deletedBy: uuid("deleted_by").references(() => users.id)
})

// Tasks
export const tasks = pgTable("task", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  type: integer("type").default(TaskType.TASK).notNull().$type<TaskType>(),
  priority: integer("priority").default(TaskPriority.LOW).$type<TaskPriority>(),
  status: integer("status").default(TaskStatus.BACKLOG).$type<TaskStatus>(),
  dueDate: timestamp("due_date"),
  assignedTo: uuid("assigned_to").references(() => users.id, { onDelete: "set null" }),
  organizationId: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: uuid("created_by").references(() => users.id),
  deletedAt: timestamp("deleted_at"),
  deletedBy: uuid("deleted_by").references(() => users.id),
  // Sub-item: points at the (top-level) task this one belongs to
  parentId: uuid("parent_id"),
  // Manual order within a board column (lower first); null until a task has been dragged
  position: integer("position")
})

// Task checklist items
export const taskChecklistItems = pgTable("task_checklist_item", {
  id: uuid("id").defaultRandom().primaryKey(),
  taskId: uuid("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  content: varchar("content", { length: 500 }).notNull(),
  done: boolean("done").default(false).notNull(),
  position: integer("position").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
}, (table) => ({
  taskPositionIdx: index("task_checklist_item_task_idx").on(table.taskId, table.position)
}))

// Document version history (HTML snapshots)
export const documentVersions = pgTable("document_version", {
  id: uuid("id").defaultRandom().primaryKey(),
  documentId: uuid("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  // Set for versions saved on purpose ("Before launch"), which are never merged into later edits
  label: varchar("label", { length: 120 }),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => ({
  documentCreatedIdx: index("document_version_doc_created_idx").on(table.documentId, table.createdAt)
}))

// Task teams junction table
export const taskTeams = pgTable("task_team", {
  id: uuid("id").defaultRandom().primaryKey(),
  taskId: uuid("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  teamId: uuid("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull()
}, (table) => ({
  taskTeamUnique: unique().on(table.taskId, table.teamId)
}))

// Task comments
export const taskComments = pgTable("task_comment", {
  id: uuid("id").primaryKey(),
  taskId: uuid("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull()
})

// Documents
export const documents = pgTable("document", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  teamId: uuid("team_id").references(() => teams.id, { onDelete: "cascade" }),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: uuid("updated_by").references(() => users.id),
  deletedAt: timestamp("deleted_at"),
  deletedBy: uuid("deleted_by").references(() => users.id)
})

// Document roles
export const documentRoles = pgTable("document_roles", {
  id: uuid("id").defaultRandom().primaryKey(),
  documentId: uuid("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  teamId: uuid("team_id").references(() => teams.id, { onDelete: "cascade" }),
  role: integer("role").notNull().$type<DocumentRole>()
}, (table) => ({
  uniqueUser: unique().on(table.documentId, table.userId),
  uniqueTeam: unique().on(table.documentId, table.teamId)
}))

// Document comments
export const documentComments = pgTable("document_comment", {
  id: uuid("id").defaultRandom().primaryKey(),
  documentId: uuid("document_id")
    .notNull()
    .references(() => documents.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  // Reply to a top-level comment
  parentId: uuid("parent_id"),
  // The document text this comment/suggestion refers to
  quote: text("quote"),
  // 'comment' | 'suggestion' (a proposed replacement for `quote`)
  kind: varchar("kind", { length: 16 }).default("comment").notNull(),
  suggestion: text("suggestion"),
  // comment: 'open' | 'resolved'; suggestion: 'open' | 'accepted' | 'rejected'
  status: varchar("status", { length: 16 }).default("open").notNull(),
  resolvedBy: uuid("resolved_by").references(() => users.id, { onDelete: "set null" }),
  resolvedAt: timestamp("resolved_at")
})

// In-app notifications
export const notifications = pgTable("notification", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
  // 'documents' | 'tasks' | 'messages' - matches the per-module settings
  module: varchar("module", { length: 32 }).notNull(),
  type: varchar("type", { length: 64 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  body: text("body"),
  link: varchar("link", { length: 512 }),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow().notNull()
}, (table) => ({
  userCreatedIdx: index("notification_user_created_idx").on(table.userId, table.createdAt)
}))

// Per-module notification settings (a missing row means everything is on)
export const notificationSettings = pgTable("notification_setting", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  documents: boolean("documents").default(true).notNull(),
  tasks: boolean("tasks").default(true).notNull(),
  messages: boolean("messages").default(true).notNull()
})


// External links on tasks (git pull requests/commits/issues, shared files)
export const taskLinks = pgTable("task_link", {
  id: uuid("id").defaultRandom().primaryKey(),
  taskId: uuid("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  url: varchar("url", { length: 2048 }).notNull(),
  // 'github' | 'gitlab' | 'gdrive' | 'dropbox' | 'other'
  provider: varchar("provider", { length: 16 }).notNull(),
  // 'pull_request' | 'issue' | 'commit' | 'branch' | 'repo' | 'file' | 'link'
  kind: varchar("kind", { length: 16 }).notNull(),
  label: varchar("label", { length: 255 }).notNull(),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull()
}, (table) => ({
  taskUrlUnique: unique().on(table.taskId, table.url)
}))

// Secret tokens for calendar (.ics) subscriptions
export const calendarFeedTokens = pgTable("calendar_feed_token", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 64 }).notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull()
})


// Saved task filters ("views"), per user
export const taskSavedViews = pgTable("task_saved_view", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 80 }).notNull(),
  // { status, assignee, team, search }: validated by the API
  filters: text("filters").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
}, (table) => ({
  userNameUnique: unique().on(table.userId, table.name)
}))
