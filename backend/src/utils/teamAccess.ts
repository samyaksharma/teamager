import { and, eq } from 'drizzle-orm'
import { db, teamUsers } from '../db'
import { TeamRole } from '../types/enums'

// The user's role in a team, or null when they are not a member
export async function getTeamRole(userId: string, teamId: string): Promise<TeamRole | null> {
  const rows = await db.select({ role: teamUsers.role }).from(teamUsers)
    .where(and(eq(teamUsers.userId, userId), eq(teamUsers.teamId, teamId))).limit(1)
  return rows.length > 0 ? (rows[0].role as TeamRole) : null
}

// Members who may create and change content in the team (everyone except read-only Viewers)
export async function canWriteInTeam(userId: string, teamId: string): Promise<boolean> {
  const role = await getTeamRole(userId, teamId)
  return role !== null && role !== TeamRole.VIEWER
}

// Ids of the user's teams in which they may create and change content
export async function writableTeamIds(userId: string): Promise<string[]> {
  const rows = await db.select({ teamId: teamUsers.teamId, role: teamUsers.role }).from(teamUsers)
    .where(eq(teamUsers.userId, userId))
  return rows.filter(r => r.role !== TeamRole.VIEWER).map(r => r.teamId)
}

export const VIEWER_MESSAGE = 'Viewers have read-only access to this team'

// Is the user allowed to write in at least one of the given teams (all must pass when `all` is set)
export async function canWriteInTeams(userId: string, teamIds: string[], all = false): Promise<boolean> {
  if (teamIds.length === 0) return true
  const writable = new Set(await writableTeamIds(userId))
  return all ? teamIds.every(id => writable.has(id)) : teamIds.some(id => writable.has(id))
}
