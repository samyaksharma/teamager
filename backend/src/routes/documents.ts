import express from 'express'
import { eq, and, or, isNull, sql } from 'drizzle-orm'
import { db, documents, users, teams, teamUsers, organizationUsers, documentRoles } from '../db'
import { verifyToken } from '../middleware/auth'
import { getDocumentPermissions, checkDocumentAccess, assignDocumentRole, removeDocumentRole } from '../utils/permissions'
import { DocumentRole } from '../types/enums'

const router = express.Router()

// Apply auth middleware to all routes
router.use(verifyToken)

// Get documents - matches frontend GET /api/documents and /api/documents?teamId={teamId}
router.get('/', async (req, res) => {
  try {
    const { teamId } = req.query
    const userId = req.user!.userId


    // Get user's teams for access control
    const userTeams = await db.select({ teamId: teamUsers.teamId })
      .from(teamUsers)
      .where(eq(teamUsers.userId, userId))

    const teamIds = userTeams.map(ut => ut.teamId)

    // Build conditions first
    const conditions: any[] = []

    if (teamId) {
      // Filter by specific team
      conditions.push(
        and(
          eq(documents.teamId, teamId as string),
          or(
            eq(documents.createdBy, userId), // Created by user
            teamIds.length > 0 ? 
              eq(documents.teamId, teamId as string) : // User is member of team
              sql`1=0` // No access
          )
        )
      )
    } else {
      // Get all accessible documents
      conditions.push(
        or(
          eq(documents.createdBy, userId), // Created by user
          teamIds.length > 0 ? 
            sql`${documents.teamId} IN ${teamIds}` : // From user's teams
            sql`1=0`, // No teams, no access
          isNull(documents.teamId) // Personal documents
        )
      )
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

    // Add permissions to each document
    const docsWithPermissions = await Promise.all(
      docs.map(async (doc) => {
        const permissions = await getDocumentPermissions(doc.id, userId)
        return {
          ...doc,
          permissions
        }
      })
    )

    res.json(docsWithPermissions)
  } catch (error) {
    console.error('Get documents error:', error)
    res.status(500).json({ message: 'Failed to get documents' })
  }
})

// Get document by ID - matches frontend GET /api/documents/{docId}
router.get('/:docId', async (req, res) => {
  try {
    const { docId } = req.params
    const userId = req.user!.userId

    // Get document with author info
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
    
    // Check if user has permission to view this document
    const hasAccess = await checkDocumentAccess(docId, userId, DocumentRole.VIEWER)
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied to this document' })
    }

    // Get user's permissions for this document
    const permissions = await getDocumentPermissions(docId, userId)
    
    res.json({
      ...document,
      permissions
    })
  } catch (error) {
    console.error('Get document error:', error)
    res.status(500).json({ message: 'Failed to get document' })
  }
})

// Create document - matches frontend POST /api/documents
router.post('/', async (req, res) => {
  try {
    const { title, content = '', teamId } = req.body
    const userId = req.user!.userId


    if (!title) {
      return res.status(400).json({ message: 'Document title is required' })
    }

    // If teamId provided, verify user is member
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
    }

    // Create document
    const newDoc = await db.insert(documents)
      .values({
        title,
        content,
        teamId: teamId || null,
        ownerId: userId, // Set owner to creator
        createdBy: userId,
        updatedBy: userId
      })
      .returning()

    // Get document with author info
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

// Update document - matches frontend PUT /api/documents/{docId}
router.put('/:docId', async (req, res) => {
  try {
    const { docId } = req.params
    const { title, content, teamId } = req.body
    const userId = req.user!.userId

    // Check if document exists and user has access
    const existingDoc = await db.select()
      .from(documents)
      .where(eq(documents.id, docId))
      .limit(1)

    if (existingDoc.length === 0) {
      return res.status(404).json({ message: 'Document not found' })
    }

    // Check if user has permission to edit this document
    const hasEditAccess = await checkDocumentAccess(docId, userId, DocumentRole.EDITOR)
    if (!hasEditAccess) {
      return res.status(403).json({ message: 'Access denied to edit this document' })
    }

    // Build update object
    const updateData: any = { updatedBy: userId, updatedAt: new Date() }
    if (title !== undefined) updateData.title = title
    if (content !== undefined) updateData.content = content
    if (teamId !== undefined) updateData.teamId = teamId

    // Update document
    const updatedDoc = await db.update(documents)
      .set(updateData)
      .where(eq(documents.id, docId))
      .returning()

    // Get updated document with author info
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

// Delete document - matches frontend DELETE /api/documents/{docId}
router.delete('/:docId', async (req, res) => {
  try {
    const { docId } = req.params
    const userId = req.user!.userId

    // Check if document exists and user has access
    const existingDoc = await db.select()
      .from(documents)
      .where(eq(documents.id, docId))
      .limit(1)

    if (existingDoc.length === 0) {
      return res.status(404).json({ message: 'Document not found' })
    }

    const document = existingDoc[0]

    // Check if user is the owner (only owner can delete)
    if (document.ownerId !== userId) {
      return res.status(403).json({ message: 'Only the document owner can delete it' })
    }

    // Delete document
    await db.delete(documents)
      .where(eq(documents.id, docId))

    res.json({ message: 'Document deleted successfully' })
  } catch (error) {
    console.error('Delete document error:', error)
    res.status(500).json({ message: 'Failed to delete document' })
  }
})

// WebRTC room verification - secure collaboration access
router.post('/:docId/verify-access', async (req, res) => {
  try {
    const { docId } = req.params
    const userId = req.user!.userId

    // Check if document exists and user has access
    const existingDoc = await db.select()
      .from(documents)
      .where(eq(documents.id, docId))
      .limit(1)

    if (existingDoc.length === 0) {
      return res.status(404).json({ message: 'Document not found' })
    }

    // Check if user has permission to access this document
    const permissions = await getDocumentPermissions(docId, userId)
    

    if (!permissions.canView) {
      return res.status(403).json({ message: 'Access denied to this document' })
    }

    // Generate secure room token
    const roomToken = `${docId}-${userId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    // Return verification success with room token
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

// Get document permissions/roles - GET /api/documents/{docId}/permissions
router.get('/:docId/permissions', async (req, res) => {
  try {
    const { docId } = req.params
    const userId = req.user!.userId

    // Check if user has admin access to view permissions
    const permissions = await getDocumentPermissions(docId, userId)
    if (!permissions.canAdmin && permissions.effectiveRole !== 'owner') {
      return res.status(403).json({ message: 'Access denied to view document permissions' })
    }

    // Get all document roles
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

    // Get document owner info
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
      roles: roles || []
    })
  } catch (error) {
    console.error('Get document permissions error:', error)
    res.status(500).json({ message: 'Failed to get document permissions' })
  }
})

// Assign role to user or team - POST /api/documents/{docId}/permissions
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

    const result = await assignDocumentRole(docId, assignerId, targetUserId, targetTeamId, role)
    
    if (!result.success) {
      return res.status(403).json({ message: result.error })
    }

    res.json({ message: 'Role assigned successfully' })
  } catch (error) {
    console.error('Assign document role error:', error)
    res.status(500).json({ message: 'Failed to assign role' })
  }
})

// Remove role from user or team - DELETE /api/documents/{docId}/permissions
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