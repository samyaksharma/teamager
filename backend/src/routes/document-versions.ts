import express from 'express'
import { eq, and, desc, sql } from 'drizzle-orm'
import { db, documents, documentVersions, users } from '../db'
import { verifyToken } from '../middleware/auth'
import { checkDocumentAccess } from '../utils/permissions'
import { DocumentRole } from '../types/enums'

// Version history for documents. Mounted on /api/documents next to the main document routes.
const router = express.Router()

router.use(verifyToken)

const MAX_LISTED = 100

router.get('/:docId/versions', async (req, res) => {
  try {
    const { docId } = req.params
    if (!(await checkDocumentAccess(docId, req.user!.userId, DocumentRole.VIEWER))) {
      return res.status(403).json({ message: 'Access denied to this document' })
    }

    const versions = await db.select({
      id: documentVersions.id,
      title: documentVersions.title,
      label: documentVersions.label,
      createdAt: documentVersions.createdAt,
      updatedAt: documentVersions.updatedAt,
      authorName: users.name,
      size: sql<number>`length(${documentVersions.content})::int`
    })
      .from(documentVersions)
      .leftJoin(users, eq(documentVersions.createdBy, users.id))
      .where(eq(documentVersions.documentId, docId))
      .orderBy(desc(documentVersions.updatedAt))
      .limit(MAX_LISTED)

    res.json(versions)
  } catch (error) {
    console.error('List document versions error:', error)
    res.status(500).json({ message: 'Failed to get version history' })
  }
})

router.get('/:docId/versions/:versionId', async (req, res) => {
  try {
    const { docId, versionId } = req.params
    if (!(await checkDocumentAccess(docId, req.user!.userId, DocumentRole.VIEWER))) {
      return res.status(403).json({ message: 'Access denied to this document' })
    }

    const found = await db.select({
      id: documentVersions.id,
      title: documentVersions.title,
      content: documentVersions.content,
      label: documentVersions.label,
      createdAt: documentVersions.createdAt,
      updatedAt: documentVersions.updatedAt,
      authorName: users.name
    })
      .from(documentVersions)
      .leftJoin(users, eq(documentVersions.createdBy, users.id))
      .where(and(eq(documentVersions.id, versionId), eq(documentVersions.documentId, docId)))
      .limit(1)

    if (found.length === 0) return res.status(404).json({ message: 'Version not found' })
    res.json(found[0])
  } catch (error) {
    console.error('Get document version error:', error)
    res.status(500).json({ message: 'Failed to get version' })
  }
})

router.post('/:docId/versions', async (req, res) => {
  try {
    const { docId } = req.params
    const userId = req.user!.userId
    const label = typeof req.body.label === 'string' ? req.body.label.trim() : ''
    if (!label || label.length > 120) {
      return res.status(400).json({ message: 'A version name is required (max 120 characters)' })
    }
    if (!(await checkDocumentAccess(docId, userId, DocumentRole.EDITOR))) {
      return res.status(403).json({ message: 'Access denied to edit this document' })
    }

    const doc = await db.select().from(documents).where(eq(documents.id, docId)).limit(1)
    if (doc.length === 0) return res.status(404).json({ message: 'Document not found' })

    const [version] = await db.insert(documentVersions).values({
      documentId: docId,
      title: doc[0].title,
      content: doc[0].content,
      label,
      createdBy: userId
    }).returning({ id: documentVersions.id, label: documentVersions.label, createdAt: documentVersions.createdAt })

    res.status(201).json(version)
  } catch (error) {
    console.error('Create named version error:', error)
    res.status(500).json({ message: 'Failed to save version' })
  }
})

// Restore a version: snapshot the current content first, then make the version current.
// The client applies the returned content to the open editor so collaborators receive it.
router.post('/:docId/versions/:versionId/restore', async (req, res) => {
  try {
    const { docId, versionId } = req.params
    const userId = req.user!.userId
    if (!(await checkDocumentAccess(docId, userId, DocumentRole.EDITOR))) {
      return res.status(403).json({ message: 'Access denied to edit this document' })
    }

    const target = await db.select().from(documentVersions)
      .where(and(eq(documentVersions.id, versionId), eq(documentVersions.documentId, docId))).limit(1)
    if (target.length === 0) return res.status(404).json({ message: 'Version not found' })

    const doc = await db.select().from(documents).where(eq(documents.id, docId)).limit(1)
    if (doc.length === 0) return res.status(404).json({ message: 'Document not found' })

    if (doc[0].content !== target[0].content) {
      await db.insert(documentVersions).values({
        documentId: docId,
        title: doc[0].title,
        content: doc[0].content,
        label: 'Before restore',
        createdBy: userId
      })
    }

    await db.update(documents)
      .set({ content: target[0].content, updatedBy: userId, updatedAt: new Date() })
      .where(eq(documents.id, docId))

    res.json({ content: target[0].content, title: target[0].title })
  } catch (error) {
    console.error('Restore document version error:', error)
    res.status(500).json({ message: 'Failed to restore version' })
  }
})

export default router
