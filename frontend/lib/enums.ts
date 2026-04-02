/**
 * Frontend Enum Definitions for Teamager
 * 
 * This file mirrors the backend enums and provides utilities for the frontend.
 * All enums use integer values for consistency with the backend.
 */

// =============================================================================
// TASK ENUMS
// =============================================================================

export enum TaskPriority {
  LOW = 0,
  MEDIUM = 1,
  HIGH = 2,
  CRITICAL = 3
}

export enum TaskStatus {
  BACKLOG = 0,
  TODO = 1,
  IN_PROGRESS = 2,
  IN_REVIEW = 3,
  DONE = 4,
  CANCELLED = 5
}

export enum TaskType {
  TASK = 0,
  BUG = 1,
  FEATURE = 2,
  ENHANCEMENT = 3,
  DOCUMENTATION = 4,
  EPIC = 5
}

// =============================================================================
// ROLE ENUMS
// =============================================================================

export enum OrganizationRole {
  MEMBER = 0,
  ADMIN = 1,
  OWNER = 2
}

export enum TeamRole {
  MEMBER = 0,
  CONTRIBUTOR = 1,
  LEAD = 2
}

export enum DocumentRole {
  VIEWER = 0,
  COMMENTER = 1,
  EDITOR = 2,
  ADMIN = 3
}

// =============================================================================
// COMMUNICATION ENUMS
// =============================================================================

export enum ChannelType {
  TEXT = 0,
  VOICE = 1,
  ANNOUNCEMENT = 2,
  PRIVATE = 3
}

export enum MessageType {
  TEXT = 0,
  FILE = 1,
  IMAGE = 2,
  SYSTEM = 3
}

// =============================================================================
// USER & SESSION ENUMS
// =============================================================================

export enum UserStatus {
  PENDING = 0,
  ACTIVE = 1,
  SUSPENDED = 2,
  DEACTIVATED = 3
}

export enum InvitationStatus {
  PENDING = 0,
  ACCEPTED = 1,
  DECLINED = 2,
  EXPIRED = 3,
  CANCELLED = 4
}

// =============================================================================
// DISPLAY LABELS
// =============================================================================

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

// =============================================================================
// UI UTILITIES
// =============================================================================

/**
 * Get options for Select components
 */
export const getEnumOptions = {
  TaskPriority: () => Object.entries(EnumLabels.TaskPriority).map(([value, label]) => ({
    value: parseInt(value),
    label
  })),
  
  TaskStatus: () => Object.entries(EnumLabels.TaskStatus).map(([value, label]) => ({
    value: parseInt(value),
    label
  })),
  
  TaskType: () => Object.entries(EnumLabels.TaskType).map(([value, label]) => ({
    value: parseInt(value),
    label
  })),
  
  OrganizationRole: () => Object.entries(EnumLabels.OrganizationRole).map(([value, label]) => ({
    value: parseInt(value),
    label
  })),
  
  TeamRole: () => Object.entries(EnumLabels.TeamRole).map(([value, label]) => ({
    value: parseInt(value),
    label
  })),
  
  DocumentRole: () => Object.entries(EnumLabels.DocumentRole).map(([value, label]) => ({
    value: parseInt(value),
    label
  }))
}

/**
 * Get display label for enum value
 */
export const getEnumLabel = {
  TaskPriority: (value: TaskPriority): string => EnumLabels.TaskPriority[value] || 'Unknown',
  TaskStatus: (value: TaskStatus): string => EnumLabels.TaskStatus[value] || 'Unknown',
  TaskType: (value: TaskType): string => EnumLabels.TaskType[value] || 'Unknown',
  OrganizationRole: (value: OrganizationRole): string => EnumLabels.OrganizationRole[value] || 'Unknown',
  TeamRole: (value: TeamRole): string => EnumLabels.TeamRole[value] || 'Unknown',
  DocumentRole: (value: DocumentRole): string => EnumLabels.DocumentRole[value] || 'Unknown'
}

/**
 * CSS classes for different enum values
 */
export const getEnumStyles = {
  TaskPriority: (priority: TaskPriority) => {
    switch (priority) {
      case TaskPriority.LOW:
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case TaskPriority.MEDIUM:
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case TaskPriority.HIGH:
        return 'bg-orange-100 text-orange-800 border-orange-200'
      case TaskPriority.CRITICAL:
        return 'bg-red-100 text-red-800 border-red-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  },
  
  TaskStatus: (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.BACKLOG:
        return 'bg-gray-100 text-gray-800 border-gray-200'
      case TaskStatus.TODO:
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case TaskStatus.IN_PROGRESS:
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case TaskStatus.IN_REVIEW:
        return 'bg-purple-100 text-purple-800 border-purple-200'
      case TaskStatus.DONE:
        return 'bg-green-100 text-green-800 border-green-200'
      case TaskStatus.CANCELLED:
        return 'bg-red-100 text-red-800 border-red-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  },
  
  TaskType: (type: TaskType) => {
    switch (type) {
      case TaskType.TASK:
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case TaskType.BUG:
        return 'bg-red-100 text-red-800 border-red-200'
      case TaskType.FEATURE:
        return 'bg-green-100 text-green-800 border-green-200'
      case TaskType.ENHANCEMENT:
        return 'bg-purple-100 text-purple-800 border-purple-200'
      case TaskType.DOCUMENTATION:
        return 'bg-indigo-100 text-indigo-800 border-indigo-200'
      case TaskType.EPIC:
        return 'bg-pink-100 text-pink-800 border-pink-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }
}

/**
 * Icon mappings for enum values
 */
export const getEnumIcon = {
  TaskPriority: (priority: TaskPriority) => {
    switch (priority) {
      case TaskPriority.LOW: return '🔵'
      case TaskPriority.MEDIUM: return '🟡'
      case TaskPriority.HIGH: return '🟠'
      case TaskPriority.CRITICAL: return '🔴'
      default: return '⚪'
    }
  },
  
  TaskStatus: (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.BACKLOG: return '📋'
      case TaskStatus.TODO: return '📝'
      case TaskStatus.IN_PROGRESS: return '⏳'
      case TaskStatus.IN_REVIEW: return '👀'
      case TaskStatus.DONE: return '✅'
      case TaskStatus.CANCELLED: return '❌'
      default: return '❓'
    }
  },
  
  TaskType: (type: TaskType) => {
    switch (type) {
      case TaskType.TASK: return '📋'
      case TaskType.BUG: return '🐛'
      case TaskType.FEATURE: return '✨'
      case TaskType.ENHANCEMENT: return '⚡'
      case TaskType.DOCUMENTATION: return '📚'
      case TaskType.EPIC: return '🎯'
      default: return '📄'
    }
  }
}

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
 * Validation utilities
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