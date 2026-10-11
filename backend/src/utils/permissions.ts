import { eq, and, or, inArray, sql, SQL } from 'drizzle-orm'
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

export function hasRolePermission(userRole: DocumentRole, requiredRole: DocumentRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole]
}

export async function getDocumentPermissions(
  documentId: string, 
  userId: string
): Promise<DocumentPermission> {
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

  if (effectiveRole === null) {
    const userTeams = await db.select({ teamId: teamUsers.teamId })
      .from(teamUsers)
      .where(eq(teamUsers.userId, userId))

    const teamIds = userTeams.map(ut => ut.teamId)

    if (teamIds.length > 0) {
      const teamRoles = await db.select({
        role: documentRoles.role
      })
        .from(documentRoles)
        .where(and(
          eq(documentRoles.documentId, documentId),
          inArray(documentRoles.teamId, teamIds)
        ))
        .orderBy(documentRoles.role) // This will get the first role alphabetically, but we'll process for highest

      let highestTeamRole: DocumentRole | null = null
      for (const teamRole of teamRoles) {
        const role = teamRole.role as DocumentRole
        if (highestTeamRole === null || ROLE_HIERARCHY[role] > ROLE_HIERARCHY[highestTeamRole]) {
          highestTeamRole = role
        }
      }

      effectiveRole = highestTeamRole
    }
  }

  // If still no role and document has a team, check if user is team member (fallback team access)
  if (effectiveRole === null && doc.teamId) {
    const isTeamMember = await db.select()
      .from(teamUsers)
      .where(and(
        eq(teamUsers.teamId, doc.teamId),
        eq(teamUsers.userId, userId)
      ))
      .limit(1)

    if (isTeamMember.length > 0) {
      effectiveRole = DocumentRole.VIEWER
    }
  }

  // No permissions found (note: DocumentRole.VIEWER is 0, so test for null explicitly)
  if (effectiveRole === null) {
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

export async function checkDocumentAccess(
  documentId: string, 
  userId: string, 
  requiredRole: DocumentRole = DocumentRole.VIEWER
): Promise<boolean> {
  const permissions = await getDocumentPermissions(documentId, userId)
  
  if (permissions.effectiveRole === 'owner') {
    return true
  }
  
  if (permissions.effectiveRole === null) {
    return false
  }
  
  return hasRolePermission(permissions.effectiveRole as DocumentRole, requiredRole)
}

export async function assignDocumentRole(
  documentId: string,
  assignerId: string,
  role: DocumentRole,
  targetUserId?: string,
  targetTeamId?: string
): Promise<{ success: boolean; error?: string }> {
  const assignerPermissions = await getDocumentPermissions(documentId, assignerId)
  
  if (!assignerPermissions.canShare) {
    return { success: false, error: 'Insufficient permissions to assign roles' }
  }

  try {
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

export async function removeDocumentRole(
  documentId: string,
  removerId: string,
  targetUserId?: string,
  targetTeamId?: string
): Promise<{ success: boolean; error?: string }> {
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

/**
 * SQL condition matching the documents a user can view. Mirrors getDocumentPermissions:
 * owner, a direct role, a role granted to one of the user's teams, or membership of the document's team.
 * Documents without a team are visible only to their owner or people they were shared with.
 */
export function viewableDocumentsCondition(userId: string, userTeamIds: string[]): SQL {
  const access: SQL[] = [
    eq(documents.ownerId, userId),
    sql`exists (select 1 from ${documentRoles} where ${documentRoles.documentId} = ${documents.id} and ${documentRoles.userId} = ${userId})`
  ]
  if (userTeamIds.length > 0) {
    access.push(inArray(documents.teamId, userTeamIds))
    access.push(sql`exists (select 1 from ${documentRoles} where ${documentRoles.documentId} = ${documents.id} and ${inArray(documentRoles.teamId, userTeamIds)})`)
  }
  return or(...access)!
}
