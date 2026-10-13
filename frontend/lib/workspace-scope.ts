// The app shows one organization at a time. These keep lists that the API returns across all of a user's
// organizations to the selected one. Personal items (no organization / no team) belong to the person, so they stay.

export function scopeTasksToOrganization<T extends { organizationId?: string | null }>(
  tasks: T[],
  organizationId?: string | null
): T[] {
  if (!organizationId) return tasks
  return tasks.filter(t => !t.organizationId || t.organizationId === organizationId)
}

export function scopeDocumentsToTeams<T extends { teamId?: string | null }>(
  documents: T[],
  teamIds: string[]
): T[] {
  const allowed = new Set(teamIds)
  return documents.filter(d => !d.teamId || allowed.has(d.teamId))
}
