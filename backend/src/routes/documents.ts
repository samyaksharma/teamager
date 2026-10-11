import express from 'express'
import { eq, and, or, isNull, sql } from 'drizzle-orm'
import { db, documents, users, teams, teamUsers, organizationUsers, documentRoles } from '../db'
import { notify } from '../utils/inAppNotifications'
import { recordVersionOnSave } from '../utils/documentVersions'
import { verifyToken } from '../middleware/auth'
import { getDocumentPermissions, checkDocumentAccess, viewableDocumentsCondition, assignDocumentRole, removeDocumentRole } from '../utils/permissions'
import { DocumentRole, TeamRole } from '../types/enums'

const router = express.Router()

router.use(verifyToken)

// Get documents - matches frontend GET /api/documents and /api/documents?teamId={teamId}
// API role names <-> stored DocumentRole values
const ROLE_BY_NAME: Record<string, DocumentRole> = {
  viewer: DocumentRole.VIEWER,
  commenter: DocumentRole.COMMENTER,
  editor: DocumentRole.EDITOR,
  admin: DocumentRole.ADMIN
}
const ROLE_NAMES: Record<number, string> = Object.fromEntries(Object.entries(ROLE_BY_NAME).map(([name, value]) => [value, name]))

// Responses expose the effective role by name ('owner', 'viewer', ...), not its stored number
const withRoleName = <T extends { effectiveRole: DocumentRole | 'owner' | null }>(permissions: T) => ({
  ...permissions,
  effectiveRole: typeof permissions.effectiveRole === 'number' ? ROLE_NAMES[permissions.effectiveRole] : permissions.effectiveRole
})

router.get('/', async (req, res) => {
  try {
    const { teamId } = req.query
    const userId = req.user!.userId

    const userTeams = await db.select({ teamId: teamUsers.teamId })
      .from(teamUsers)
      .where(eq(teamUsers.userId, userId))

    const teamIds = userTeams.map(ut => ut.teamId)

    // Only documents the user can view (same rules as the single-document permission check)
    const conditions: any[] = [viewableDocumentsCondition(userId, teamIds)]
    if (teamId) {
      conditions.push(eq(documents.teamId, teamId as string))
    }

    const docs = await db.select({
      id: documents.id,
      title: documents.title,
      content: documents.content,
      teamId: documents.teamId,
      ownerId: documents.ownerId,
      createdBy: documents.createdBy,
      createdAt: documents.createdAt,
      updatedAt: documents.updatedAt,
      updatedBy: documents.updatedBy,
      authorName: users.name,
      teamName: teams.name
    })
      .from(documents)
      .leftJoin(users, eq(documents.createdBy, users.id))
      .leftJoin(teams, eq(documents.teamId, teams.id))
      .where(and(...conditions))

    const docsWithPermissions = await Promise.all(
      docs.map(async (doc) => {
        const permissions = await getDocumentPermissions(doc.id, userId)
        return {
          ...doc,
          permissions: withRoleName(permissions)
        }
      })
    )

    res.json(docsWithPermissions)
  } catch (error) {
    console.error('Get documents error:', error)
    res.status(500).json({ message: 'Failed to get documents' })
  }
})

router.get('/:docId', async (req, res) => {
  try {
    const { docId } = req.params
    const userId = req.user!.userId

    const doc = await db.select({
      id: documents.id,
      title: documents.title,
      content: documents.content,
      teamId: documents.teamId,
      ownerId: documents.ownerId,
      createdBy: documents.createdBy,
      createdAt: documents.createdAt,
      updatedAt: documents.updatedAt,
      updatedBy: documents.updatedBy,
      authorName: users.name
    })
      .from(documents)
      .leftJoin(users, eq(documents.createdBy, users.id))
      .where(eq(documents.id, docId))
      .limit(1)

    if (doc.length === 0) {
      return res.status(404).json({ message: 'Document not found' })
    }

    const document = doc[0]
    
    const hasAccess = await checkDocumentAccess(docId, userId, DocumentRole.VIEWER)
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied to this document' })
    }

    const permissions = await getDocumentPermissions(docId, userId)
    
    res.json({
      ...document,
      permissions: withRoleName(permissions)
    })
  } catch (error) {
    console.error('Get document error:', error)
    res.status(500).json({ message: 'Failed to get document' })
  }
})

router.post('/', async (req, res) => {
  try {
    const { title, content = '', teamId } = req.body
    const userId = req.user!.userId

    if (!title) {
      return res.status(400).json({ message: 'Document title is required' })
    }

    if (teamId) {
      const teamMembership = await db.select()
        .from(teamUsers)
        .where(and(
          eq(teamUsers.teamId, teamId),
          eq(teamUsers.userId, userId)
        ))
        .limit(1)

      if (teamMembership.length === 0) {
        return res.status(403).json({ message: 'Access denied to this team' })
      }
      if (teamMembership[0].role === TeamRole.VIEWER) {
        return res.status(403).json({ message: 'Viewers have read-only access to this team' })
      }
    }

    const newDoc = await db.insert(documents)
      .values({
        title,
        content,
        teamId: teamId || null,
        ownerId: userId,
        createdBy: userId,
        updatedBy: userId
      })
      .returning()

    const docWithAuthor = await db.select({
      id: documents.id,
      title: documents.title,
      content: documents.content,
      teamId: documents.teamId,
      ownerId: documents.ownerId,
      createdBy: documents.createdBy,
      createdAt: documents.createdAt,
      updatedAt: documents.updatedAt,
      updatedBy: documents.updatedBy,
      authorName: users.name
    })
      .from(documents)
      .leftJoin(users, eq(documents.createdBy, users.id))
      .where(eq(documents.id, newDoc[0].id))
      .limit(1)

    res.status(201).json(docWithAuthor[0])
  } catch (error) {
    console.error('Create document error:', error)
    res.status(500).json({ message: 'Failed to create document' })
  }
})

router.put('/:docId', async (req, res) => {
  try {
    const { docId } = req.params
    const { title, content, teamId } = req.body
    const userId = req.user!.userId

    const existingDoc = await db.select()
      .from(documents)
      .where(eq(documents.id, docId))
      .limit(1)

    if (existingDoc.length === 0) {
      return res.status(404).json({ message: 'Document not found' })
    }

    const hasEditAccess = await checkDocumentAccess(docId, userId, DocumentRole.EDITOR)
    if (!hasEditAccess) {
      return res.status(403).json({ message: 'Access denied to edit this document' })
    }

    const updateData: any = { updatedBy: userId, updatedAt: new Date() }
    if (title !== undefined) updateData.title = title
    if (content !== undefined) updateData.content = content
    if (teamId !== undefined) updateData.teamId = teamId

    const updatedDoc = await db.update(documents)
      .set(updateData)
      .where(eq(documents.id, docId))
      .returning()

    if (typeof content === 'string') {
      await recordVersionOnSave(existingDoc[0], content, userId)
    }

    const docWithAuthor = await db.select({
      id: documents.id,
      title: documents.title,
      content: documents.content,
      teamId: documents.teamId,
      ownerId: documents.ownerId,
      createdBy: documents.createdBy,
      createdAt: documents.createdAt,
      updatedAt: documents.updatedAt,
      updatedBy: documents.updatedBy,
      authorName: users.name
    })
      .from(documents)
      .leftJoin(users, eq(documents.createdBy, users.id))
      .where(eq(documents.id, docId))
      .limit(1)

    res.json(docWithAuthor[0])
  } catch (error) {
    console.error('Update document error:', error)
    res.status(500).json({ message: 'Failed to update document' })
  }
})

router.delete('/:docId', async (req, res) => {
  try {
    const { docId } = req.params
    const userId = req.user!.userId

    const existingDoc = await db.select()
      .from(documents)
      .where(eq(documents.id, docId))
      .limit(1)

    if (existingDoc.length === 0) {
      return res.status(404).json({ message: 'Document not found' })
    }

    const document = existingDoc[0]

    if (document.ownerId !== userId) {
      return res.status(403).json({ message: 'Only the document owner can delete it' })
    }

    await db.delete(documents)
      .where(eq(documents.id, docId))

    res.json({ message: 'Document deleted successfully' })
  } catch (error) {
    console.error('Delete document error:', error)
    res.status(500).json({ message: 'Failed to delete document' })
  }
})

router.post('/:docId/verify-access', async (req, res) => {
  try {
    const { docId } = req.params
    const userId = req.user!.userId

    const existingDoc = await db.select()
      .from(documents)
      .where(eq(documents.id, docId))
      .limit(1)

    if (existingDoc.length === 0) {
      return res.status(404).json({ message: 'Document not found' })
    }

    const permissions = await getDocumentPermissions(docId, userId)

    if (!permissions.canView) {
      return res.status(403).json({ message: 'Access denied to this document' })
    }

    const roomToken = `${docId}-${userId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    res.json({
      verified: true,
      roomToken,
      documentId: docId,
      userId,
      userName: (req.user as any).name || req.user!.email,
      permissions
    })
  } catch (error) {
    console.error('WebRTC access verification error:', error)
    res.status(500).json({ message: 'Failed to verify document access' })
  }
})

router.get('/:docId/permissions', async (req, res) => {
  try {
    const { docId } = req.params
    const userId = req.user!.userId

    const permissions = await getDocumentPermissions(docId, userId)
    if (!permissions.canAdmin && permissions.effectiveRole !== 'owner') {
      return res.status(403).json({ message: 'Access denied to view document permissions' })
    }

    const roles = await db.select({
      id: documentRoles.id,
      userId: documentRoles.userId,
      teamId: documentRoles.teamId,
      role: documentRoles.role,
      userName: users.name,
      userEmail: users.email,
      teamName: teams.name
    })
      .from(documentRoles)
      .leftJoin(users, eq(documentRoles.userId, users.id))
      .leftJoin(teams, eq(documentRoles.teamId, teams.id))
      .where(eq(documentRoles.documentId, docId))

    const document = await db.select({
      ownerId: documents.ownerId,
      ownerName: users.name,
      ownerEmail: users.email
    })
      .from(documents)
      .leftJoin(users, eq(documents.ownerId, users.id))
      .where(eq(documents.id, docId))
      .limit(1)

    res.json({
      owner: document[0] || null,
      roles: roles.map(r => ({ ...r, role: ROLE_NAMES[r.role] ?? r.role }))
    })
  } catch (error) {
    console.error('Get document permissions error:', error)
    res.status(500).json({ message: 'Failed to get document permissions' })
  }
})

router.post('/:docId/permissions', async (req, res) => {
  try {
    const { docId } = req.params
    const { userId: targetUserId, teamId: targetTeamId, role } = req.body
    const assignerId = req.user!.userId

    if (!targetUserId && !targetTeamId) {
      return res.status(400).json({ message: 'Must specify either userId or teamId' })
    }

    if (!role || !['viewer', 'commenter', 'editor', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role. Must be viewer, commenter, editor, or admin' })
    }

    const result = await assignDocumentRole(docId, assignerId, ROLE_BY_NAME[role], targetUserId, targetTeamId)
    
    if (!result.success) {
      return res.status(403).json({ message: result.error })
    }

    if (targetUserId) {
      const doc = await db.select({ title: documents.title }).from(documents).where(eq(documents.id, docId)).limit(1)
      await notify({ userId: targetUserId, actorId: assignerId, module: 'documents', type: 'document_shared', title: `shared a document with you as ${role}`, body: doc[0]?.title, link: `/dashboard/documents/${docId}` })
    }

    res.json({ message: 'Role assigned successfully' })
  } catch (error) {
    console.error('Assign document role error:', error)
    res.status(500).json({ message: 'Failed to assign role' })
  }
})

router.delete('/:docId/permissions', async (req, res) => {
  try {
    const { docId } = req.params
    const { userId: targetUserId, teamId: targetTeamId } = req.query
    const removerId = req.user!.userId

    if (!targetUserId && !targetTeamId) {
      return res.status(400).json({ message: 'Must specify either userId or teamId' })
    }

    const result = await removeDocumentRole(docId, removerId, targetUserId as string, targetTeamId as string)
    
    if (!result.success) {
      return res.status(403).json({ message: result.error })
    }

    res.json({ message: 'Role removed successfully' })
  } catch (error) {
    console.error('Remove document role error:', error)
    res.status(500).json({ message: 'Failed to remove role' })
  }
})

export default router