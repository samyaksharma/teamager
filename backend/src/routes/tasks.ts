import express from 'express'
import { eq, and, or, isNull, inArray, sql } from 'drizzle-orm'
import { db, tasks, users, teams, teamUsers, taskTeams, taskChecklistItems, organizations } from '../db'
import { notify } from '../utils/inAppNotifications'
import { canWriteInTeams, writableTeamIds, VIEWER_MESSAGE } from '../utils/teamAccess'
import { verifyToken } from '../middleware/auth'
import { TaskStatus, TaskPriority, TaskType } from '../types/enums'

const router = express.Router()

// Apply auth middleware to all routes
router.use(verifyToken)

// Get tasks - matches frontend GET /api/tasks with various query parameters
router.get('/', async (req, res) => {
  try {
    const { teamId, organizationId, assignedTo, status } = req.query
    const userId = req.user!.userId

    // Get user's accessible teams and organization
    const user = await db.select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    if (user.length === 0) {
      return res.status(404).json({ message: 'User not found' })
    }

    const userTeams = await db.select({ teamId: teamUsers.teamId })
      .from(teamUsers)
      .where(eq(teamUsers.userId, userId))

    const teamIds = userTeams.map(ut => ut.teamId)

    // Get accessible task IDs through task-team junction
    let accessibleTaskIds: string[] = []
    if (teamIds.length > 0) {
      const taskTeamRecords = await db.select({ taskId: taskTeams.taskId })
        .from(taskTeams)
        .where(sql`${taskTeams.teamId} IN ${teamIds}`)
      accessibleTaskIds = taskTeamRecords.map(tt => tt.taskId)
    }

    // Build query conditions
    const conditions: any[] = []

    // Base access filter
    conditions.push(
      or(
        // Tasks from user's teams (via taskTeam junction)
        accessibleTaskIds.length > 0 ? sql`${tasks.id} IN ${accessibleTaskIds}` : sql`1=0`,
        // Personal tasks created by user (not associated with any team)
        and(
          eq(tasks.createdBy, userId),
          isNull(tasks.organizationId)
        ),
        // Tasks assigned to user
        eq(tasks.assignedTo, userId)
      )
    )

    // Sub-items are shown inside their parent task, not as top-level tasks
    conditions.push(isNull(tasks.parentId))

    // Apply filters
    if (teamId) {
      // Get tasks associated with specific team
      const teamSpecificTaskIds = await db.select({ taskId: taskTeams.taskId })
        .from(taskTeams)
        .where(eq(taskTeams.teamId, teamId as string))
      
      const specificTaskIds = teamSpecificTaskIds.map(t => t.taskId)
      
      conditions.push(
        specificTaskIds.length > 0 ? sql`${tasks.id} IN ${specificTaskIds}` : sql`1=0`
      )
    }

    if (organizationId) {
      conditions.push(eq(tasks.organizationId, organizationId as string))
    }

    if (assignedTo) {
      if (assignedTo === 'null') {
        conditions.push(isNull(tasks.assignedTo))
      } else {
        conditions.push(eq(tasks.assignedTo, assignedTo as string))
      }
    }

    if (status !== undefined && status !== null) {
      const statusNum = Number(status) as 0 | 1 | 2
      conditions.push(eq(tasks.status, statusNum))
    }

    // Execute query
    const tasksData = await db.select({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      priority: tasks.priority,
      status: tasks.status,
      dueDate: tasks.dueDate,
      createdAt: tasks.createdAt,
      organizationId: tasks.organizationId,
      assignedTo: tasks.assignedTo,
      createdBy: tasks.createdBy,
      creatorName: users.name,
      organizationName: organizations.name
    })
      .from(tasks)
      .leftJoin(users, eq(tasks.createdBy, users.id))
      .leftJoin(organizations, eq(tasks.organizationId, organizations.id))
      .where(and(...conditions))
      .orderBy(sql`${tasks.position} asc nulls last`, tasks.dueDate, tasks.priority)

    // Get assignee details for each task
    const userIds = tasksData
      .map(t => t.assignedTo)
      .filter(id => id !== null) as string[]

    let assignees: any[] = []
    if (userIds.length > 0) {
      assignees = await db.select({
        id: users.id,
        name: users.name,
        email: users.email,
        avatarUrl: users.avatarUrl
      })
        .from(users)
        .where(sql`${users.id} IN ${userIds}`)
    }

    // Progress of sub-items and checklists, shown on task cards
    const taskIds = tasksData.map(t => t.id)
    const [subtaskCounts, checklistCounts] = taskIds.length === 0 ? [[], []] : await Promise.all([
      db.select({
        id: tasks.parentId,
        total: sql<number>`count(*)::int`,
        done: sql<number>`count(*) filter (where ${tasks.status} = 4)::int`
      }).from(tasks).where(inArray(tasks.parentId, taskIds)).groupBy(tasks.parentId),
      db.select({
        id: taskChecklistItems.taskId,
        total: sql<number>`count(*)::int`,
        done: sql<number>`count(*) filter (where ${taskChecklistItems.done})::int`
      }).from(taskChecklistItems).where(inArray(taskChecklistItems.taskId, taskIds)).groupBy(taskChecklistItems.taskId)
    ])

    // Merge assignee data
    const tasksWithAssignees = tasksData.map(task => {
      const subs = subtaskCounts.find(c => c.id === task.id)
      const checks = checklistCounts.find(c => c.id === task.id)
      return {
        ...task,
        assignee: task.assignedTo ? assignees.find(a => a.id === task.assignedTo) : null,
        subtaskTotal: subs?.total ?? 0,
        subtaskDone: subs?.done ?? 0,
        checklistTotal: checks?.total ?? 0,
        checklistDone: checks?.done ?? 0
      }
    })

    res.json(tasksWithAssignees)
  } catch (error) {
    console.error('Get tasks error:', error)
    res.status(500).json({ message: 'Failed to get tasks' })
  }
})

// Get task by ID - matches frontend GET /api/tasks/{taskId}
router.get('/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params
    const userId = req.user!.userId

    // Get task with related data
    const task = await db.select({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      priority: tasks.priority,
      status: tasks.status,
      dueDate: tasks.dueDate,
      createdAt: tasks.createdAt,
      organizationId: tasks.organizationId,
      assignedTo: tasks.assignedTo,
      createdBy: tasks.createdBy,
      creatorName: users.name,
      organizationName: organizations.name
    })
      .from(tasks)
      .leftJoin(users, eq(tasks.createdBy, users.id))
      .leftJoin(organizations, eq(tasks.organizationId, organizations.id))
      .where(eq(tasks.id, taskId))
      .limit(1)

    if (task.length === 0) {
      return res.status(404).json({ message: 'Task not found' })
    }

    const taskData = task[0]

    // Check access permissions
    let hasAccess = false

    // Creator or assignee has access
    if (taskData.createdBy === userId || taskData.assignedTo === userId) {
      hasAccess = true
    }

    // Check team access via taskTeams junction
    if (!hasAccess) {
      const userTeams = await db.select({ teamId: teamUsers.teamId })
        .from(teamUsers)
        .where(eq(teamUsers.userId, userId))

      if (userTeams.length > 0) {
        const teamIds = userTeams.map(ut => ut.teamId)
        const taskTeamAccess = await db.select()
          .from(taskTeams)
          .where(and(
            eq(taskTeams.taskId, taskId),
            sql`${taskTeams.teamId} IN ${teamIds}`
          ))
          .limit(1)

        hasAccess = taskTeamAccess.length > 0
      }
    }

    // Check organization access via user's teams
    if (!hasAccess && taskData.organizationId) {
      const userTeams = await db.select({ orgId: teams.organizationId })
        .from(teamUsers)
        .leftJoin(teams, eq(teamUsers.teamId, teams.id))
        .where(and(
          eq(teamUsers.userId, userId),
          eq(teams.organizationId, taskData.organizationId)
        ))
        .limit(1)

      hasAccess = userTeams.length > 0
    }

    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied to this task' })
    }

    // Get assignee details
    let assignee = null
    if (taskData.assignedTo) {
      const assigneeData = await db.select({
        id: users.id,
        name: users.name,
        email: users.email,
        avatarUrl: users.avatarUrl
      })
        .from(users)
        .where(eq(users.id, taskData.assignedTo))
        .limit(1)

      assignee = assigneeData[0] || null
    }

    res.json({
      ...taskData,
      assignee
    })
  } catch (error) {
    console.error('Get task error:', error)
    res.status(500).json({ message: 'Failed to get task' })
  }
})

// Create task - matches frontend POST /api/tasks
router.post('/', async (req, res) => {
  try {
    const { 
      title, 
      description, 
      priority = 0, 
      status = 0, 
      dueDate, 
      assignedTo, 
      teamId, 
      teamIds,
      organizationId 
    } = req.body
    const userId = req.user!.userId

    if (!title) {
      return res.status(400).json({ message: 'Task title is required' })
    }

    // Determine teams to associate with task
    let allTeamIds: string[] = []
    if (teamId) allTeamIds.push(teamId)
    if (teamIds && Array.isArray(teamIds)) {
      allTeamIds = [...allTeamIds, ...teamIds]
    }
    allTeamIds = [...new Set(allTeamIds)] // Remove duplicates

    // Verify team access
    if (allTeamIds.length > 0) {
      const userTeams = await db.select({ teamId: teamUsers.teamId })
        .from(teamUsers)
        .where(and(
          eq(teamUsers.userId, userId),
          sql`${teamUsers.teamId} IN ${allTeamIds}`
        ))

      const accessibleTeamIds = userTeams.map(ut => ut.teamId)
      const inaccessibleTeams = allTeamIds.filter(id => !accessibleTeamIds.includes(id))
      
      if (inaccessibleTeams.length > 0) {
        return res.status(403).json({ message: 'Access denied to some teams' })
      }

      if (!(await canWriteInTeams(userId, allTeamIds, true))) {
        return res.status(403).json({ message: VIEWER_MESSAGE })
      }
    }

    // Create task
    const newTask = await db.insert(tasks)
      .values({
        title,
        description,
        priority,
        status,
        dueDate: dueDate ? new Date(dueDate) : null,
        assignedTo,
        organizationId,
        createdBy: userId
      })
      .returning()

    // Create task-team associations
    if (allTeamIds.length > 0) {
      const taskTeamValues = allTeamIds.map(tid => ({
        taskId: newTask[0].id,
        teamId: tid
      }))

      await db.insert(taskTeams)
        .values(taskTeamValues)
    }

    // Get created task with related data
    const taskWithData = await db.select({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      priority: tasks.priority,
      status: tasks.status,
      dueDate: tasks.dueDate,
      createdAt: tasks.createdAt,
      organizationId: tasks.organizationId,
      assignedTo: tasks.assignedTo,
      createdBy: tasks.createdBy,
      creatorName: users.name,
      organizationName: organizations.name
    })
      .from(tasks)
      .leftJoin(users, eq(tasks.createdBy, users.id))
      .leftJoin(organizations, eq(tasks.organizationId, organizations.id))
      .where(eq(tasks.id, newTask[0].id))
      .limit(1)

    if (assignedTo) {
      await notify({ userId: assignedTo, actorId: userId, module: 'tasks', type: 'task_assigned', title: 'assigned you a task', body: newTask[0].title, link: '/dashboard/tasks' })
    }

    // Get assignee details
    let assignee = null
    if (assignedTo) {
      const assigneeData = await db.select({
        id: users.id,
        name: users.name,
        email: users.email,
        avatarUrl: users.avatarUrl
      })
        .from(users)
        .where(eq(users.id, assignedTo))
        .limit(1)

      assignee = assigneeData[0] || null
    }

    res.status(201).json({
      ...taskWithData[0],
      assignee
    })
  } catch (error) {
    console.error('Create task error:', error)
    res.status(500).json({ message: 'Failed to create task' })
  }
})

// Move tasks to a status and set their order within it: PUT /api/tasks/reorder { status, taskIds }
// (registered before /:taskId so "reorder" isn't read as an id)
router.put('/reorder', async (req, res) => {
  try {
    const userId = req.user!.userId
    const { status, taskIds } = req.body
    const validStatuses = [TaskStatus.BACKLOG, TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.IN_REVIEW, TaskStatus.DONE, TaskStatus.CANCELLED]

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' })
    }
    if (!Array.isArray(taskIds) || taskIds.length === 0 || taskIds.length > 200 || taskIds.some((id: unknown) => typeof id !== 'string')) {
      return res.status(400).json({ message: 'taskIds must be a list of task ids (max 200)' })
    }

    // Only tasks the user may change: their own, assigned to them, or in a team where they aren't a Viewer
    const writable = await writableTeamIds(userId)
    const teamTaskIds = writable.length > 0
      ? (await db.select({ taskId: taskTeams.taskId }).from(taskTeams).where(inArray(taskTeams.teamId, writable))).map(t => t.taskId)
      : []
    const found = await db.select({ id: tasks.id, createdBy: tasks.createdBy, assignedTo: tasks.assignedTo })
      .from(tasks).where(and(inArray(tasks.id, taskIds), isNull(tasks.deletedAt)))
    const allowed = new Set(found
      .filter(t => t.createdBy === userId || t.assignedTo === userId || teamTaskIds.includes(t.id))
      .map(t => t.id))

    if (taskIds.some((id: string) => !allowed.has(id))) {
      return res.status(403).json({ message: 'You cannot change one or more of these tasks' })
    }

    for (let i = 0; i < taskIds.length; i++) {
      await db.update(tasks).set({ status, position: i }).where(eq(tasks.id, taskIds[i]))
    }
    res.json({ message: 'Tasks reordered', updated: taskIds.length })
  } catch (error) {
    console.error('Reorder tasks error:', error)
    res.status(500).json({ message: 'Failed to reorder tasks' })
  }
})

// Update task - matches frontend PUT /api/tasks/{taskId}
router.put('/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params
    const { title, description, priority, status, dueDate, assignedTo, teamId, teamIds } = req.body
    const userId = req.user!.userId

    // Check if task exists and user has access
    const existingTask = await db.select()
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .limit(1)

    if (existingTask.length === 0) {
      return res.status(404).json({ message: 'Task not found' })
    }

    const task = existingTask[0]

    // Check permissions (creator, assignee, or team member)
    let hasAccess = task.createdBy === userId || task.assignedTo === userId

    if (!hasAccess) {
      // Check via taskTeams junction (Viewers can read tasks but not change them)
      const teamIds = await writableTeamIds(userId)

      if (teamIds.length > 0) {
        const taskTeamAccess = await db.select()
          .from(taskTeams)
          .where(and(
            eq(taskTeams.taskId, taskId),
            sql`${taskTeams.teamId} IN ${teamIds}`
          ))
          .limit(1)

        hasAccess = taskTeamAccess.length > 0
      }
    }

    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied to this task' })
    }

    // Build update object
    const updateData: any = {}
    if (title !== undefined) updateData.title = title
    if (description !== undefined) updateData.description = description
    if (priority !== undefined) updateData.priority = priority
    if (status !== undefined) updateData.status = status
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo

    // Handle team associations
    if (teamIds !== undefined) {
      // Update task-team associations
      await db.delete(taskTeams)
        .where(eq(taskTeams.taskId, taskId))

      if (Array.isArray(teamIds) && teamIds.length > 0) {
        const taskTeamValues = teamIds.map((tid: string) => ({
          taskId,
          teamId: tid
        }))

        await db.insert(taskTeams)
          .values(taskTeamValues)
      }
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: 'No update data provided' })
    }

    // Update task
    await db.update(tasks)
      .set(updateData)
      .where(eq(tasks.id, taskId))

    if (assignedTo && assignedTo !== existingTask[0].assignedTo) {
      await notify({ userId: assignedTo, actorId: userId, module: 'tasks', type: 'task_assigned', title: 'assigned you a task', body: updateData.title ?? existingTask[0].title, link: '/dashboard/tasks' })
    }

    // Get updated task with related data
    const updatedTask = await db.select({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      priority: tasks.priority,
      status: tasks.status,
      dueDate: tasks.dueDate,
      createdAt: tasks.createdAt,
      organizationId: tasks.organizationId,
      assignedTo: tasks.assignedTo,
      createdBy: tasks.createdBy,
      creatorName: users.name,
      organizationName: organizations.name
    })
      .from(tasks)
      .leftJoin(users, eq(tasks.createdBy, users.id))
      .leftJoin(organizations, eq(tasks.organizationId, organizations.id))
      .where(eq(tasks.id, taskId))
      .limit(1)

    // Get assignee details
    let assignee = null
    if (updatedTask[0].assignedTo) {
      const assigneeData = await db.select({
        id: users.id,
        name: users.name,
        email: users.email,
        avatarUrl: users.avatarUrl
      })
        .from(users)
        .where(eq(users.id, updatedTask[0].assignedTo))
        .limit(1)

      assignee = assigneeData[0] || null
    }

    res.json({
      ...updatedTask[0],
      assignee
    })
  } catch (error) {
    console.error('Update task error:', error)
    res.status(500).json({ message: 'Failed to update task' })
  }
})

// Delete task - matches frontend DELETE /api/tasks/{taskId}
router.delete('/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params
    const userId = req.user!.userId

    // Check if task exists and user has access
    const existingTask = await db.select()
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .limit(1)

    if (existingTask.length === 0) {
      return res.status(404).json({ message: 'Task not found' })
    }

    const task = existingTask[0]

    // Only creator can delete task
    if (task.createdBy !== userId) {
      return res.status(403).json({ message: 'Only the task creator can delete it' })
    }

    // Delete task (cascade will handle task-team associations)
    await db.delete(tasks)
      .where(eq(tasks.id, taskId))

    res.json({ message: 'Task deleted successfully' })
  } catch (error) {
    console.error('Delete task error:', error)
    res.status(500).json({ message: 'Failed to delete task' })
  }
})

export default router