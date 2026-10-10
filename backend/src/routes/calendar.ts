import express from 'express'
import crypto from 'crypto'
import { eq, and, or, isNull, inArray } from 'drizzle-orm'
import { db, calendarFeedTokens, tasks, taskTeams, teamUsers, users } from '../db'
import { verifyToken } from '../middleware/auth'
import { TaskStatus } from '../types/enums'

// Calendar subscription: an iCalendar (.ics) feed of the user's tasks with due dates, behind a secret URL
// so Google Calendar, Outlook and Apple Calendar can subscribe without any OAuth setup.
const router = express.Router()

const newToken = () => crypto.randomBytes(24).toString('hex')

const feedUrl = (req: express.Request, token: string) =>
  `${req.protocol}://${req.get('host')}/api/calendar/feed/${token}.ics`

// ---- iCalendar helpers (RFC 5545) ----
const escapeText = (text: string) =>
  text.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

// Lines are limited to 75 octets; continuation lines start with a space
function fold(line: string) {
  const out: string[] = []
  let current = ''
  let bytes = 0
  for (const ch of line) {
    const size = Buffer.byteLength(ch)
    if (bytes + size > (out.length === 0 ? 75 : 74)) {
      out.push(current)
      current = ''
      bytes = 0
    }
    current += ch
    bytes += size
  }
  out.push(current)
  return out.join('\r\n ')
}

const icsDate = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '')
const icsStamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

// Get (or create) the signed-in user's subscription URL
router.get('/feed', verifyToken, async (req, res) => {
  try {
    const userId = req.user!.userId
    let row = (await db.select().from(calendarFeedTokens).where(eq(calendarFeedTokens.userId, userId)).limit(1))[0]
    if (!row) {
      row = (await db.insert(calendarFeedTokens).values({ userId, token: newToken() }).returning())[0]
    }
    res.json({ url: feedUrl(req, row.token) })
  } catch (error) {
    console.error('Get calendar feed error:', error)
    res.status(500).json({ message: 'Failed to get calendar feed' })
  }
})

// Replace the token, which invalidates the old URL
router.post('/feed/rotate', verifyToken, async (req, res) => {
  try {
    const userId = req.user!.userId
    const token = newToken()
    await db.insert(calendarFeedTokens).values({ userId, token })
      .onConflictDoUpdate({ target: calendarFeedTokens.userId, set: { token, createdAt: new Date() } })
    res.json({ url: feedUrl(req, token) })
  } catch (error) {
    console.error('Rotate calendar feed error:', error)
    res.status(500).json({ message: 'Failed to rotate calendar feed' })
  }
})

// The feed itself. Authenticated by the secret token in the URL (calendar apps can't send cookies).
router.get('/feed/:token.ics', async (req, res) => {
  try {
    const owner = await db.select({ userId: calendarFeedTokens.userId, name: users.name })
      .from(calendarFeedTokens)
      .innerJoin(users, eq(calendarFeedTokens.userId, users.id))
      .where(eq(calendarFeedTokens.token, req.params.token)).limit(1)
    if (owner.length === 0) return res.status(404).type('text/plain').send('Not found')
    const userId = owner[0].userId

    // Same visibility as the task list: own, assigned, or in one of the user's teams
    const myTeams = (await db.select({ teamId: teamUsers.teamId }).from(teamUsers).where(eq(teamUsers.userId, userId)))
      .map(t => t.teamId)
    const teamTaskIds = myTeams.length > 0
      ? (await db.select({ taskId: taskTeams.taskId }).from(taskTeams).where(inArray(taskTeams.teamId, myTeams))).map(t => t.taskId)
      : []

    const visible = [eq(tasks.assignedTo, userId), and(eq(tasks.createdBy, userId), isNull(tasks.organizationId))!]
    if (teamTaskIds.length > 0) visible.push(inArray(tasks.id, teamTaskIds))

    const rows = await db.select().from(tasks).where(and(isNull(tasks.deletedAt), or(...visible)))
    const dated = rows.filter(t => t.dueDate)

    const now = icsStamp(new Date())
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Teamager//Tasks//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      `X-WR-CALNAME:${escapeText('Teamager tasks')}`,
    ]
    for (const t of dated) {
      const due = t.dueDate as Date
      const next = new Date(due.getTime() + 24 * 60 * 60 * 1000)
      const done = t.status === TaskStatus.DONE
      lines.push(
        'BEGIN:VEVENT',
        `UID:task-${t.id}@teamager`,
        `DTSTAMP:${now}`,
        `DTSTART;VALUE=DATE:${icsDate(due)}`,
        `DTEND;VALUE=DATE:${icsDate(next)}`,
        `SUMMARY:${escapeText((done ? '[Done] ' : '') + t.title)}`,
        ...(t.description ? [`DESCRIPTION:${escapeText(t.description)}`] : []),
        `STATUS:${t.status === TaskStatus.CANCELLED ? 'CANCELLED' : 'CONFIRMED'}`,
        'END:VEVENT'
      )
    }
    lines.push('END:VCALENDAR')

    res.set('Content-Type', 'text/calendar; charset=utf-8')
    res.set('Cache-Control', 'private, max-age=300')
    res.send(lines.map(fold).join('\r\n') + '\r\n')
  } catch (error) {
    console.error('Calendar feed error:', error)
    res.status(500).type('text/plain').send('Failed to build calendar')
  }
})

export default router
