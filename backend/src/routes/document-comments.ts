import express from 'express'
import { eq, and, asc } from 'drizzle-orm'
import { db, documents, documentComments, users } from '../db'
import { verifyToken } from '../middleware/auth'
import { checkDocumentAccess } from '../utils/permissions'
import { notify } from '../utils/inAppNotifications'
import { DocumentRole } from '../types/enums'

// Comments and suggestions on documents. Mounted on /api/documents next to the main document routes.
const router = express.Router()

router.use(verifyToken)

const MAX_TEXT = 5000
const text = (value: unknown) => (typeof value === 'string' ? value : '')

const commentSelect = {
  id: documentComments.id,
  parentId: documentComments.parentId,
  content: documentComments.content,
  quote: documentComments.quote,
  kind: documentComments.kind,
  suggestion: documentComments.suggestion,
  status: documentComments.status,
  createdBy: documentComments.createdBy,
  createdAt: documentComments.createdAt,
  resolvedAt: documentComments.resolvedAt,
  authorName: users.name
}

// List all comments and suggestions (replies are linked through parentId)
router.get('/:docId/comments', async (req, res) => {
  try {
    const { docId } = req.params
    if (!(await checkDocumentAccess(docId, req.user!.userId, DocumentRole.VIEWER))) {
      return res.status(403).json({ message: 'Access denied to this document' })
    }

    const rows = await db.select(commentSelect)
      .from(documentComments)
      .leftJoin(users, eq(documentComments.createdBy, users.id))
      .where(eq(documentComments.documentId, docId))
      .orderBy(asc(documentComments.createdAt))
    res.json(rows)
  } catch (error) {
    console.error('List document comments error:', error)
    res.status(500).json({ message: 'Failed to get comments' })
  }
})

// Add a comment, a reply (parentId), or a suggestion (quote + suggestion)
router.post('/:docId/comments', async (req, res) => {
  try {
    const { docId } = req.params
    const userId = req.user!.userId
    const content = text(req.body.content).trim()
    const quote = text(req.body.quote).trim()
    const isSuggestion = typeof req.body.suggestion === 'string'
    const parentId: string | null = req.body.parentId || null

    if (!isSuggestion && !content) {
      return res.status(400).json({ message: 'Comment text is required' })
    }
    if (content.length > MAX_TEXT || quote.length > MAX_TEXT || text(req.body.suggestion).length > MAX_TEXT) {
      return res.status(400).json({ message: `Text is too long (max ${MAX_TEXT} characters)` })
    }
    if (isSuggestion && !quote) {
      return res.status(400).json({ message: 'A suggestion must refer to selected text' })
    }
    if (isSuggestion && parentId) {
      return res.status(400).json({ message: 'Suggestions cannot be replies' })
    }

    if (!(await checkDocumentAccess(docId, userId, DocumentRole.COMMENTER))) {
      return res.status(403).json({ message: 'You do not have permission to comment on this document' })
    }

    let parentAuthor: string | null = null
    if (parentId) {
      const parent = await db.select().from(documentComments)
        .where(and(eq(documentComments.id, parentId), eq(documentComments.documentId, docId))).limit(1)
      if (parent.length === 0 || parent[0].parentId || parent[0].kind !== 'comment') {
        return res.status(400).json({ message: 'Replies must target a top-level comment on this document' })
      }
      parentAuthor = parent[0].createdBy
    }

    const [created] = await db.insert(documentComments).values({
      documentId: docId,
      content,
      createdBy: userId,
      parentId,
      quote: quote || null,
      kind: isSuggestion ? 'suggestion' : 'comment',
      suggestion: isSuggestion ? text(req.body.suggestion) : null
    }).returning()

    const doc = await db.select({ ownerId: documents.ownerId, title: documents.title }).from(documents)
      .where(eq(documents.id, docId)).limit(1)
    const recipient = parentAuthor ?? doc[0]?.ownerId
    if (recipient) {
      await notify({
        userId: recipient,
        actorId: userId,
        module: 'documents',
        type: isSuggestion ? 'document_suggestion' : parentId ? 'document_reply' : 'document_comment',
        title: isSuggestion ? 'suggested an edit' : parentId ? 'replied to your comment' : 'commented on a document',
        body: `${doc[0]?.title ?? 'Document'}: ${content || quote}`,
        link: `/dashboard/documents/${docId}`
      })
    }

    const [row] = await db.select(commentSelect)
      .from(documentComments)
      .leftJoin(users, eq(documentComments.createdBy, users.id))
      .where(eq(documentComments.id, created.id))
    res.status(201).json(row)
  } catch (error) {
    console.error('Create document comment error:', error)
    res.status(500).json({ message: 'Failed to add comment' })
  }
})

// Resolve/reopen a comment thread, or accept/reject a suggestion.
// (Applying an accepted suggestion to the text is done by the client, through the live editor.)
router.put('/:docId/comments/:commentId', async (req, res) => {
  try {
    const { docId, commentId } = req.params
    const userId = req.user!.userId
    const status = text(req.body.status)

    const found = await db.select().from(documentComments)
      .where(and(eq(documentComments.id, commentId), eq(documentComments.documentId, docId))).limit(1)
    if (found.length === 0) return res.status(404).json({ message: 'Comment not found' })
    const comment = found[0]

    const allowed = comment.kind === 'suggestion' ? ['accepted', 'rejected'] : ['open', 'resolved']
    if (!allowed.includes(status) || comment.parentId) {
      return res.status(400).json({ message: `Status must be one of: ${comment.parentId ? 'none (replies have no status)' : allowed.join(', ')}` })
    }
    if (comment.kind === 'suggestion' && comment.status !== 'open') {
      return res.status(409).json({ message: `This suggestion was already ${comment.status}` })
    }

    // Suggestions change the document, so they need edit rights; threads can also be resolved by their author
    const needsEditor = comment.kind === 'suggestion' || comment.createdBy !== userId
    if (!(await checkDocumentAccess(docId, userId, needsEditor ? DocumentRole.EDITOR : DocumentRole.COMMENTER))) {
      return res.status(403).json({ message: 'You do not have permission to do that' })
    }

    await db.update(documentComments)
      .set({ status, resolvedBy: status === 'open' ? null : userId, resolvedAt: status === 'open' ? null : new Date() })
      .where(eq(documentComments.id, commentId))

    if (comment.kind === 'suggestion') {
      await notify({
        userId: comment.createdBy,
        actorId: userId,
        module: 'documents',
        type: `document_suggestion_${status}`,
        title: `${status} your suggestion`,
        body: comment.quote,
        link: `/dashboard/documents/${docId}`
      })
    }

    const [row] = await db.select(commentSelect)
      .from(documentComments)
      .leftJoin(users, eq(documentComments.createdBy, users.id))
      .where(eq(documentComments.id, commentId))
    res.json(row)
  } catch (error) {
    console.error('Update document comment error:', error)
    res.status(500).json({ message: 'Failed to update comment' })
  }
})

// Delete a comment (author, or an admin of the document); replies go with it
router.delete('/:docId/comments/:commentId', async (req, res) => {
  try {
    const { docId, commentId } = req.params
    const userId = req.user!.userId

    const found = await db.select().from(documentComments)
      .where(and(eq(documentComments.id, commentId), eq(documentComments.documentId, docId))).limit(1)
    if (found.length === 0) return res.status(404).json({ message: 'Comment not found' })

    const allowed = found[0].createdBy === userId || await checkDocumentAccess(docId, userId, DocumentRole.ADMIN)
    if (!allowed) return res.status(403).json({ message: 'You can only delete your own comments' })

    await db.delete(documentComments).where(eq(documentComments.id, commentId))
    res.json({ message: 'Comment deleted' })
  } catch (error) {
    console.error('Delete document comment error:', error)
    res.status(500).json({ message: 'Failed to delete comment' })
  }
})

export default router
