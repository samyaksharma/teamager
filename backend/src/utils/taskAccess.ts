import { and, eq, inArray, isNull, or } from 'drizzle-orm'
import { db, tasks, taskTeams, teamUsers } from '../db'
import { writableTeamIds } from './teamAccess'

// Loads a task the user may use: creator, assignee, or a member of one of its teams.
// With `write`, team access excludes teams where the user is a read-only Viewer.
export async function loadTaskForUser(taskId: string, userId: string, write = false) {
  const found = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1)
  if (found.length === 0) return { status: 404, message: 'Task not found' } as const
  const task = found[0]

  let hasAccess = task.createdBy === userId || task.assignedTo === userId
  if (!hasAccess) {
    const myTeams = write
      ? await writableTeamIds(userId)
      : (await db.select({ teamId: teamUsers.teamId }).from(teamUsers).where(eq(teamUsers.userId, userId))).map(t => t.teamId)
    if (myTeams.length > 0) {
      const link = await db.select().from(taskTeams)
        .where(and(eq(taskTeams.taskId, taskId), inArray(taskTeams.teamId, myTeams))).limit(1)
      hasAccess = link.length > 0
    }
  }
  if (!hasAccess) return { status: 403, message: 'Access denied to this task' } as const
  return { task } as const
}

// Which of these tasks can the user see (read access)?
export async function visibleTaskIds(userId: string, taskIds: string[]): Promise<Set<string>> {
  if (taskIds.length === 0) return new Set()
  const direct = await db.select({ id: tasks.id }).from(tasks)
    .where(and(inArray(tasks.id, taskIds), isNull(tasks.deletedAt), or(eq(tasks.createdBy, userId), eq(tasks.assignedTo, userId))))
  const myTeams = (await db.select({ teamId: teamUsers.teamId }).from(teamUsers).where(eq(teamUsers.userId, userId))).map(t => t.teamId)
  const viaTeam = myTeams.length > 0
    ? await db.select({ id: taskTeams.taskId }).from(taskTeams)
        .innerJoin(tasks, eq(tasks.id, taskTeams.taskId))
        .where(and(inArray(taskTeams.taskId, taskIds), inArray(taskTeams.teamId, myTeams), isNull(tasks.deletedAt)))
    : []
  return new Set([...direct, ...viaTeam].map(r => r.id))
}
