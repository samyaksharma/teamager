import { eq, desc } from 'drizzle-orm'
import { db, documentVersions } from '../db'

// Edits by the same person within this window are folded into one version, so auto-save
// (every few seconds) doesn't create a version per keystroke.
const COALESCE_WINDOW_MS = 10 * 60 * 1000

interface DocumentSnapshot {
  id: string
  title: string
  content: string
  createdBy: string
  updatedBy: string | null
  updatedAt: Date
}

/**
 * Record the result of a content save in the version history.
 * `previous` is the document as it was before this save.
 * Never throws: history is secondary to saving the document.
 */
export async function recordVersionOnSave(previous: DocumentSnapshot, newContent: string, userId: string) {
  try {
    if (newContent === previous.content) return

    const latest = (await db.select().from(documentVersions)
      .where(eq(documentVersions.documentId, previous.id))
      .orderBy(desc(documentVersions.createdAt))
      .limit(1))[0]

    // Documents that predate version history: keep what was there before the first tracked edit
    if (!latest && previous.content.trim()) {
      await db.insert(documentVersions).values({
        documentId: previous.id,
        title: previous.title,
        content: previous.content,
        createdBy: previous.updatedBy ?? previous.createdBy,
        createdAt: previous.updatedAt,
        updatedAt: previous.updatedAt
      })
    }

    const now = new Date()
    const canMerge = latest
      && !latest.label
      && latest.createdBy === userId
      && now.getTime() - latest.updatedAt.getTime() < COALESCE_WINDOW_MS

    if (canMerge) {
      await db.update(documentVersions)
        .set({ content: newContent, title: previous.title, updatedAt: now })
        .where(eq(documentVersions.id, latest.id))
    } else {
      await db.insert(documentVersions).values({
        documentId: previous.id,
        title: previous.title,
        content: newContent,
        createdBy: userId
      })
    }
  } catch (error) {
    console.error('Failed to record document version:', error)
  }
}
