import { eq, and, or, inArray } from 'drizzle-orm'
import { db, documents, documentRoles, teamUsers } from '../db'
import { DocumentRole } from '../types/enums'

// Role hierarchy: viewer < commenter < editor < admin
const ROLE_HIERARCHY: Record<DocumentRole, number> = {
  [DocumentRole.VIEWER]: 1,
  [DocumentRole.COMMENTER]: 2,
  [DocumentRole.EDITOR]: 3,
  [DocumentRole.ADMIN]: 4
}

export interface DocumentPermission {
  canView: boolean
  canComment: boolean
  canEdit: boolean
  canAdmin: boolean
  canShare: boolean
  canDelete: boolean
  canTransferOwnership: boolean
  effectiveRole: DocumentRole | 'owner' | null
}

/**
 * Check if role1 has equal or higher permissions than role2
 */
export function hasRolePermission(userRole: DocumentRole, requiredRole: DocumentRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole]
}

/**
 * Get effective permissions for a user on a document
 */
export async function getDocumentPermissions(
  documentId: string, 
  userId: string
): Promise<DocumentPermission> {
  // First, get the document and check ownership
  const document = await db.select({
    ownerId: documents.ownerId,
    teamId: documents.teamId
  })
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1)

  if (document.length === 0) {
    return {
      canView: false,
      canComment: false,
      canEdit: false,
      canAdmin: false,
      canShare: false,
      canDelete: false,
      canTransferOwnership: false,
      effectiveRole: null
    }
  }

  const doc = document[0]

  // Check if user is the owner
  if (doc.ownerId === userId) {
    return {
      canView: true,
      canComment: true,
      canEdit: true,
      canAdmin: true,
      canShare: true,
      canDelete: true,
      canTransferOwnership: true,
      effectiveRole: 'owner'
    }
  }

  // Check direct user permissions in documentRoles
  const userRole = await db.select({
    role: documentRoles.role
  })
    .from(documentRoles)
    .where(and(
      eq(documentRoles.documentId, documentId),
      eq(documentRoles.userId, userId)
    ))
    .limit(1)

  let effectiveRole: DocumentRole | null = null

  if (userRole.length > 0) {
    effectiveRole = userRole[0].role as DocumentRole
  }

  // If no direct permission, check team-based permissions
  if (!effectiveRole) {
    // Get user's teams
    const userTeams = await db.select({ teamId: teamUsers.teamId })
      .from(teamUsers)
      .where(eq(teamUsers.userId, userId))

    const teamIds = userTeams.map(ut => ut.teamId)

    if (teamIds.length > 0) {
      // Check for team permissions
      const teamRoles = await db.select({
        role: documentRoles.role
      })
        .from(documentRoles)
        .where(and(
          eq(documentRoles.documentId, documentId),
          inArray(documentRoles.teamId, teamIds)
        ))
        .orderBy(documentRoles.role) // This will get the first role alphabetically, but we'll process for highest

      // Get the highest team role
      let highestTeamRole: DocumentRole | null = null
      for (const teamRole of teamRoles) {
        const role = teamRole.role as DocumentRole
        if (!highestTeamRole || ROLE_HIERARCHY[role] > ROLE_HIERARCHY[highestTeamRole]) {
          highestTeamRole = role
        }
      }

      effectiveRole = highestTeamRole
    }
  }

  // If still no role and document has a team, check if user is team member (fallback team access)
  if (!effectiveRole && doc.teamId) {
    const isTeamMember = await db.select()
      .from(teamUsers)
      .where(and(
        eq(teamUsers.teamId, doc.teamId),
        eq(teamUsers.userId, userId)
      ))
      .limit(1)

    if (isTeamMember.length > 0) {
      effectiveRole = DocumentRole.VIEWER // Default team member access
    }
  }

  // No permissions found
  if (!effectiveRole) {
    return {
      canView: false,
      canComment: false,
      canEdit: false,
      canAdmin: false,
      canShare: false,
      canDelete: false,
      canTransferOwnership: false,
      effectiveRole: null
    }
  }

  // Calculate permissions based on role
  const isAdmin = hasRolePermission(effectiveRole, DocumentRole.ADMIN)
  const canEdit = hasRolePermission(effectiveRole, DocumentRole.EDITOR)
  const canComment = hasRolePermission(effectiveRole, DocumentRole.COMMENTER)
  const canView = hasRolePermission(effectiveRole, DocumentRole.VIEWER)

  return {
    canView,
    canComment,
    canEdit,
    canAdmin: isAdmin,
    canShare: isAdmin, // Only admin and owner can share
    canDelete: false, // Only owner can delete
    canTransferOwnership: false, // Only owner can transfer ownership
    effectiveRole
  }
}

/**
 * Check if user has at least the required role for a document
 */
export async function checkDocumentAccess(
  documentId: string, 
  userId: string, 
  requiredRole: DocumentRole = DocumentRole.VIEWER
): Promise<boolean> {
  const permissions = await getDocumentPermissions(documentId, userId)
  
  if (permissions.effectiveRole === 'owner') {
    return true
  }
  
  if (!permissions.effectiveRole) {
    return false
  }
  
  return hasRolePermission(permissions.effectiveRole as DocumentRole, requiredRole)
}

/**
 * Assign a role to a user or team for a document
 * Only owner or admin can assign roles
 */
export async function assignDocumentRole(
  documentId: string,
  assignerId: string,
  role: DocumentRole,
  targetUserId?: string,
  targetTeamId?: string
): Promise<{ success: boolean; error?: string }> {
  // Check if assigner has permission to assign roles
  const assignerPermissions = await getDocumentPermissions(documentId, assignerId)
  
  if (!assignerPermissions.canShare) {
    return { success: false, error: 'Insufficient permissions to assign roles' }
  }

  try {
    // Check if role already exists and update or insert
    if (targetUserId) {
      const existing = await db.select()
        .from(documentRoles)
        .where(and(
          eq(documentRoles.documentId, documentId),
          eq(documentRoles.userId, targetUserId)
        ))
        .limit(1)

      if (existing.length > 0) {
        await db.update(documentRoles)
          .set({ role })
          .where(and(
            eq(documentRoles.documentId, documentId),
            eq(documentRoles.userId, targetUserId)
          ))
      } else {
        await db.insert(documentRoles)
          .values({
            documentId,
            userId: targetUserId,
            role
          })
      }
    } else if (targetTeamId) {
      const existing = await db.select()
        .from(documentRoles)
        .where(and(
          eq(documentRoles.documentId, documentId),
          eq(documentRoles.teamId, targetTeamId)
        ))
        .limit(1)

      if (existing.length > 0) {
        await db.update(documentRoles)
          .set({ role })
          .where(and(
            eq(documentRoles.documentId, documentId),
            eq(documentRoles.teamId, targetTeamId)
          ))
      } else {
        await db.insert(documentRoles)
          .values({
            documentId,
            teamId: targetTeamId,
            role
          })
      }
    } else {
      return { success: false, error: 'Must specify either userId or teamId' }
    }

    return { success: true }
  } catch (error) {
    console.error('Error assigning document role:', error)
    return { success: false, error: 'Failed to assign role' }
  }
}

/**
 * Remove a role from a user or team for a document
 */
export async function removeDocumentRole(
  documentId: string,
  removerId: string,
  targetUserId?: string,
  targetTeamId?: string
): Promise<{ success: boolean; error?: string }> {
  // Check if remover has permission to remove roles
  const removerPermissions = await getDocumentPermissions(documentId, removerId)
  
  if (!removerPermissions.canShare) {
    return { success: false, error: 'Insufficient permissions to remove roles' }
  }

  try {
    if (targetUserId) {
      await db.delete(documentRoles)
        .where(and(
          eq(documentRoles.documentId, documentId),
          eq(documentRoles.userId, targetUserId)
        ))
    } else if (targetTeamId) {
      await db.delete(documentRoles)
        .where(and(
          eq(documentRoles.documentId, documentId),
          eq(documentRoles.teamId, targetTeamId)
        ))
    } else {
      return { success: false, error: 'Must specify either userId or teamId' }
    }

    return { success: true }
  } catch (error) {
    console.error('Error removing document role:', error)
    return { success: false, error: 'Failed to remove role' }
  }
}