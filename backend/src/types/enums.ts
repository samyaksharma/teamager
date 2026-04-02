/**
 * Centralized Enum Definitions for Teamager
 * 
 * This file contains all enum definitions used throughout the application.
 * All enums use integer values for database storage and performance.
 */

// =============================================================================
// TASK ENUMS
// =============================================================================

export enum TaskPriority {
  LOW = 0,
  MEDIUM = 1,
  HIGH = 2,
  CRITICAL = 3  // Adding critical for better distinction
}

export enum TaskStatus {
  BACKLOG = 0,
  TODO = 1,
  IN_PROGRESS = 2,
  IN_REVIEW = 3,  // Adding review stage
  DONE = 4,
  CANCELLED = 5   // Adding cancelled for better task lifecycle
}

export enum TaskType {
  TASK = 0,
  BUG = 1,
  FEATURE = 2,
  ENHANCEMENT = 3,
  DOCUMENTATION = 4,
  EPIC = 5        // Adding epic for larger initiatives
}

// =============================================================================
// ROLE ENUMS
// =============================================================================

export enum OrganizationRole {
  MEMBER = 0,
  ADMIN = 1,
  OWNER = 2       // Higher number = more permissions
}

export enum TeamRole {
  MEMBER = 0,
  CONTRIBUTOR = 1,
  LEAD = 2        // Higher number = more permissions
}

export enum DocumentRole {
  VIEWER = 0,
  COMMENTER = 1,
  EDITOR = 2,
  ADMIN = 3       // Higher number = more permissions
}

// =============================================================================
// COMMUNICATION ENUMS
// =============================================================================

export enum ChannelType {
  TEXT = 0,
  VOICE = 1,
  ANNOUNCEMENT = 2,
  PRIVATE = 3     // Adding private channels
}

export enum MessageType {
  TEXT = 0,
  FILE = 1,
  IMAGE = 2,
  SYSTEM = 3      // For system messages like "user joined"
}

// =============================================================================
// USER & SESSION ENUMS
// =============================================================================

export enum UserStatus {
  PENDING = 0,    // Email not verified
  ACTIVE = 1,
  SUSPENDED = 2,
  DEACTIVATED = 3
}

export enum DeviceType {
  UNKNOWN = 0,
  DESKTOP = 1,
  MOBILE = 2,
  TABLET = 3
}

export enum InvitationStatus {
  PENDING = 0,
  ACCEPTED = 1,
  DECLINED = 2,
  EXPIRED = 3,
  CANCELLED = 4
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Convert enum value to human-readable string
 */
export const EnumLabels = {
  TaskPriority: {
    [TaskPriority.LOW]: 'Low',
    [TaskPriority.MEDIUM]: 'Medium', 
    [TaskPriority.HIGH]: 'High',
    [TaskPriority.CRITICAL]: 'Critical'
  },
  
  TaskStatus: {
    [TaskStatus.BACKLOG]: 'Backlog',
    [TaskStatus.TODO]: 'To Do',
    [TaskStatus.IN_PROGRESS]: 'In Progress',
    [TaskStatus.IN_REVIEW]: 'In Review',
    [TaskStatus.DONE]: 'Done',
    [TaskStatus.CANCELLED]: 'Cancelled'
  },
  
  TaskType: {
    [TaskType.TASK]: 'Task',
    [TaskType.BUG]: 'Bug',
    [TaskType.FEATURE]: 'Feature',
    [TaskType.ENHANCEMENT]: 'Enhancement',
    [TaskType.DOCUMENTATION]: 'Documentation',
    [TaskType.EPIC]: 'Epic'
  },
  
  OrganizationRole: {
    [OrganizationRole.MEMBER]: 'Member',
    [OrganizationRole.ADMIN]: 'Admin',
    [OrganizationRole.OWNER]: 'Owner'
  },
  
  TeamRole: {
    [TeamRole.MEMBER]: 'Member',
    [TeamRole.CONTRIBUTOR]: 'Contributor',
    [TeamRole.LEAD]: 'Lead'
  },
  
  DocumentRole: {
    [DocumentRole.VIEWER]: 'Viewer',
    [DocumentRole.COMMENTER]: 'Commenter',
    [DocumentRole.EDITOR]: 'Editor',
    [DocumentRole.ADMIN]: 'Admin'
  },
  
  ChannelType: {
    [ChannelType.TEXT]: 'Text',
    [ChannelType.VOICE]: 'Voice',
    [ChannelType.ANNOUNCEMENT]: 'Announcement',
    [ChannelType.PRIVATE]: 'Private'
  },
  
  UserStatus: {
    [UserStatus.PENDING]: 'Pending',
    [UserStatus.ACTIVE]: 'Active',
    [UserStatus.SUSPENDED]: 'Suspended',
    [UserStatus.DEACTIVATED]: 'Deactivated'
  },
  
  InvitationStatus: {
    [InvitationStatus.PENDING]: 'Pending',
    [InvitationStatus.ACCEPTED]: 'Accepted',
    [InvitationStatus.DECLINED]: 'Declined',
    [InvitationStatus.EXPIRED]: 'Expired',
    [InvitationStatus.CANCELLED]: 'Cancelled'
  }
} as const

/**
 * Get enum options for dropdowns/forms
 */
export const EnumOptions = {
  TaskPriority: Object.entries(EnumLabels.TaskPriority).map(([value, label]) => ({
    value: parseInt(value),
    label
  })),
  
  TaskStatus: Object.entries(EnumLabels.TaskStatus).map(([value, label]) => ({
    value: parseInt(value),
    label
  })),
  
  TaskType: Object.entries(EnumLabels.TaskType).map(([value, label]) => ({
    value: parseInt(value),
    label
  })),
  
  OrganizationRole: Object.entries(EnumLabels.OrganizationRole).map(([value, label]) => ({
    value: parseInt(value),
    label
  })),
  
  TeamRole: Object.entries(EnumLabels.TeamRole).map(([value, label]) => ({
    value: parseInt(value),
    label
  })),
  
  DocumentRole: Object.entries(EnumLabels.DocumentRole).map(([value, label]) => ({
    value: parseInt(value),
    label
  }))
} as const

/**
 * Permission checking utilities
 */
export const hasPermission = {
  organization: (userRole: OrganizationRole, requiredRole: OrganizationRole): boolean => {
    return userRole >= requiredRole
  },
  
  team: (userRole: TeamRole, requiredRole: TeamRole): boolean => {
    return userRole >= requiredRole
  },
  
  document: (userRole: DocumentRole, requiredRole: DocumentRole): boolean => {
    return userRole >= requiredRole
  }
}

/**
 * Enum validation utilities
 */
export const isValidEnum = {
  TaskPriority: (value: any): value is TaskPriority => {
    return Object.values(TaskPriority).includes(value)
  },
  
  TaskStatus: (value: any): value is TaskStatus => {
    return Object.values(TaskStatus).includes(value)
  },
  
  TaskType: (value: any): value is TaskType => {
    return Object.values(TaskType).includes(value)
  },
  
  OrganizationRole: (value: any): value is OrganizationRole => {
    return Object.values(OrganizationRole).includes(value)
  },
  
  TeamRole: (value: any): value is TeamRole => {
    return Object.values(TeamRole).includes(value)
  },
  
  DocumentRole: (value: any): value is DocumentRole => {
    return Object.values(DocumentRole).includes(value)
  }
}

// =============================================================================
// EXPORT TYPES FOR FRONTEND
// =============================================================================

export type TaskPriorityType = keyof typeof TaskPriority
export type TaskStatusType = keyof typeof TaskStatus  
export type TaskTypeType = keyof typeof TaskType
export type OrganizationRoleType = keyof typeof OrganizationRole
export type TeamRoleType = keyof typeof TeamRole
export type DocumentRoleType = keyof typeof DocumentRole