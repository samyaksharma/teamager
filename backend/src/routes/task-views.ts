import express from 'express'
import { eq, and, asc } from 'drizzle-orm'
import { db, taskSavedViews } from '../db'
import { verifyToken } from '../middleware/auth'

// Saved task filters. Mounted on /api/task-views (kept off /api/tasks so "views" can't be read as a task id).
const router = express.Router()

router.use(verifyToken)

const MAX_VIEWS = 25

interface ViewFilters {
  status: string      // 'all' or a TaskStatus number as a string
  assignee: string
  team: string
  search: string
}

// Only the known keys, as short strings, so stored data can't carry anything else
function cleanFilters(input: any): ViewFilters | null {
  if (!input || typeof input !== 'object') return null
  const str = (v: unknown, fallback: string, max = 100) => (typeof v === 'string' ? v.slice(0, max) : fallback)
  const filters: ViewFilters = {
    status: str(input.status, 'all', 10),
    assignee: str(input.assignee, 'all', 20),
    team: str(input.team, 'all', 40),
    search: str(input.search, '', 100)
  }
  if (!/^(all|[0-5])$/.test(filters.status)) return null
  if (!/^(all|me|unassigned)$/.test(filters.assignee)) return null
  if (filters.team !== 'all' && !/^[0-9a-f-]{36}$/i.test(filters.team)) return null
  return filters
}

const present = (row: { id: string; name: string; filters: string }) => ({
  id: row.id,
  name: row.name,
  filters: JSON.parse(row.filters) as ViewFilters
})

router.get('/', async (req, res) => {
  try {
    const rows = await db.select().from(taskSavedViews)
      .where(eq(taskSavedViews.userId, req.user!.userId))
      .orderBy(asc(taskSavedViews.name))
    res.json(rows.map(present))
  } catch (error) {
    console.error('List saved views error:', error)
    res.status(500).json({ message: 'Failed to get saved views' })
  }
})

// Create, or update the filters of an existing view with the same name
router.post('/', async (req, res) => {
  try {
    const userId = req.user!.userId
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : ''
    const filters = cleanFilters(req.body.filters)
    if (!name || name.length > 80) return res.status(400).json({ message: 'A view name is required (max 80 characters)' })
    if (!filters) return res.status(400).json({ message: 'Invalid filters' })

    const existing = await db.select().from(taskSavedViews).where(eq(taskSavedViews.userId, userId))
    if (!existing.some(v => v.name === name) && existing.length >= MAX_VIEWS) {
      return res.status(400).json({ message: `You can save up to ${MAX_VIEWS} views` })
    }

    const [row] = await db.insert(taskSavedViews)
      .values({ userId, name, filters: JSON.stringify(filters) })
      .onConflictDoUpdate({ target: [taskSavedViews.userId, taskSavedViews.name], set: { filters: JSON.stringify(filters) } })
      .returning()
    res.status(201).json(present(row))
  } catch (error) {
    console.error('Save view error:', error)
    res.status(500).json({ message: 'Failed to save view' })
  }
})

router.delete('/:viewId', async (req, res) => {
  try {
    const removed = await db.delete(taskSavedViews)
      .where(and(eq(taskSavedViews.id, req.params.viewId), eq(taskSavedViews.userId, req.user!.userId)))
      .returning({ id: taskSavedViews.id })
    if (removed.length === 0) return res.status(404).json({ message: 'View not found' })
    res.json({ message: 'View deleted' })
  } catch (error) {
    console.error('Delete view error:', error)
    res.status(500).json({ message: 'Failed to delete view' })
  }
})

export default router
