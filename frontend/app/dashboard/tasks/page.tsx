"use client"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  TaskPriority,
  TaskStatus,
  TaskType,
  getEnumLabel,
  getEnumOptions,
  getEnumStyles,
  getEnumIcon
} from "@/lib/enums"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  AlertCircle,
  ArrowUpDown,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  Edit,
  Filter,
  Flag,
  Loader2,
  Menu,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Tag,
  Trash2,
  User,
  UserPlus,
} from "lucide-react"
import { useState, useEffect } from "react"
import { TasksProvider, useTasks } from "./tasksContext"
import AuthContext, { useAuth } from "@/lib/authContext"

// Edit Task Form Component
function EditTaskForm({ task, teams, organizations, users, onSave, onCancel }: {
  task: any,
  teams: any[],
  organizations: any[],
  users: any[],
  onSave: (data: any) => void,
  onCancel: () => void
}) {
  const [formData, setFormData] = useState({
    title: task.title || '',
    description: task.description || '',
    priority: typeof task.priority === 'number'
      ? (task.priority === 2 ? 'high' : task.priority === 1 ? 'medium' : 'low')
      : task.priority || 'medium',
    status: typeof task.status === 'number'
      ? (task.status === 2 ? 'done' : task.status === 1 ? 'in-progress' : 'backlog')
      : task.status || 'backlog',
    assignedTo: task.assignedTo || 'unassigned',
    dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : ''
  })

  const handleFormChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-2">
        <Label htmlFor="edit-title">Title *</Label>
        <Input
          id="edit-title"
          value={formData.title}
          onChange={(e) => handleFormChange('title', e.target.value)}
          required
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="edit-description">Description</Label>
        <Textarea
          id="edit-description"
          value={formData.description}
          onChange={(e) => handleFormChange('description', e.target.value)}
          rows={3}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="edit-priority">Priority</Label>
          <Select value={formData.priority} onValueChange={(value) => handleFormChange('priority', value)}>
            <SelectTrigger id="edit-priority">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="edit-status">Status</Label>
          <Select value={formData.status} onValueChange={(value) => handleFormChange('status', value)}>
            <SelectTrigger id="edit-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="backlog">Backlog</SelectItem>
              <SelectItem value="todo">To Do</SelectItem>
              <SelectItem value="in-progress">In Progress</SelectItem>
              <SelectItem value="done">Done</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="edit-assignee">Assignee</Label>
          <Select value={formData.assignedTo} onValueChange={(value) => handleFormChange('assignedTo', value)}>
            <SelectTrigger id="edit-assignee">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {users.map(user => (
                <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="edit-due-date">Due Date</Label>
          <Input
            id="edit-due-date"
            type="date"
            value={formData.dueDate}
            onChange={(e) => handleFormChange('dueDate', e.target.value)}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit">Save Changes</Button>
      </div>
    </form>
  )
}

// Internal component that uses the tasks context
function TasksContent() {
  const {
    tasks,
    isLoading,
    error,
    createTask,
    updateTask,
    deleteTask,
    refreshTasks,
    getTasksByStatus,
    getTasksByTeam,
    getTasksByOrganization
  } = useTasks()
  const { user, organizations, teams } = useAuth()
  const [isNewIssueDialogOpen, setIsNewIssueDialogOpen] = useState(false)
  const [selectedFilter, setSelectedFilter] = useState<string>("all")
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>("all")
  const [editingTask, setEditingTask] = useState<any>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [teamMembers, setTeamMembers] = useState<any[]>([])
  const [isCreatingTask, setIsCreatingTask] = useState(false)
  const [keepDialogOpen, setKeepDialogOpen] = useState(false)
  const [showSuccessMessage, setShowSuccessMessage] = useState(false)

  // Fetch team members for assignment
  useEffect(() => {
    const fetchTeamMembers = async () => {
      try {
        let allMembers: any[] = []
        for (const team of teams) {
          const members = await fetch(`/api/teams/${team.id}/members`, {
            credentials: 'include'
          }).then(res => res.json())
          allMembers = [...allMembers, ...members]
        }
        // Remove duplicates
        const uniqueMembers = allMembers.filter((member, index, self) =>
          index === self.findIndex(m => m.id === member.id)
        )
        setTeamMembers(uniqueMembers)
      } catch (err) {
        console.error('Failed to fetch team members:', err)
      }
    }

    if (teams.length > 0) {
      fetchTeamMembers()
    }
  }, [teams])

  // Form state for new task
  const [newTaskForm, setNewTaskForm] = useState({
    title: '',
    description: '',
    type: TaskType.TASK,
    priority: TaskPriority.MEDIUM,
    status: TaskStatus.BACKLOG,
    assignedTo: 'unassigned',
    organizationId: useAuth().currentOrganization?.id || '',
    teamIds: [] as string[],
    dueDate: ''
  })

  const handleCreateTask = async () => {
    if (isCreatingTask) return // Prevent double submission

    try {
      if (!newTaskForm.title.trim()) {
        alert('Please enter a task title')
        return
      }

      setIsCreatingTask(true)

      const taskData = {
        title: newTaskForm.title,
        description: newTaskForm.description,
        type: newTaskForm.type,
        priority: newTaskForm.priority,
        status: newTaskForm.status,
        assignedTo: newTaskForm.assignedTo === 'unassigned' ? null : newTaskForm.assignedTo || null,
        organizationId: newTaskForm.organizationId || null,
        teamIds: newTaskForm.teamIds,
        dueDate: newTaskForm.dueDate ? new Date(newTaskForm.dueDate) : null
      }

      await createTask(taskData)

      // Reset form only on successful creation
      setNewTaskForm({
        title: '',
        description: '',
        type: TaskType.TASK,
        priority: TaskPriority.MEDIUM,
        status: TaskStatus.BACKLOG,
        assignedTo: 'unassigned',
        organizationId: '',
        teamIds: [],
        dueDate: ''
      })

      // Close dialog only if keepDialogOpen is false
      if (!keepDialogOpen) {
        setIsNewIssueDialogOpen(false)
      } else {
        // Show success message briefly if dialog stays open
        setShowSuccessMessage(true)
        setTimeout(() => setShowSuccessMessage(false), 3000)
      }
    } catch (err) {
      alert('Failed to create task. Please try again.')
    } finally {
      setIsCreatingTask(false)
    }
  }

  const handleFormChange = (field: string, value: any) => {
    setNewTaskForm(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const addTeamToTask = (teamId: string) => {
    if (!newTaskForm.teamIds.includes(teamId)) {
      setNewTaskForm(prev => ({
        ...prev,
        teamIds: [...prev.teamIds, teamId]
      }))
    }
  }

  const removeTeamFromTask = (teamId: string) => {
    setNewTaskForm(prev => ({
      ...prev,
      teamIds: prev.teamIds.filter(id => id !== teamId)
    }))
  }

  // Quick action functions
  const handleQuickStatusChange = async (taskId: string, newStatus: number) => {
    try {
      await updateTask(taskId, { status: newStatus })
    } catch (err) {
      alert('Failed to update task status')
    }
  }

  const handleQuickPriorityChange = async (taskId: string, newPriority: number) => {
    try {
      await updateTask(taskId, { priority: newPriority })
    } catch (err) {
      alert('Failed to update task priority')
    }
  }

  const handleQuickAssign = async (taskId: string, userId: string | null) => {
    try {
      await updateTask(taskId, { assignedTo: userId })
    } catch (err) {
      alert('Failed to assign task')
    }
  }

  const handleEditTask = (task: any) => {
    setEditingTask(task)
    setIsEditDialogOpen(true)
  }

  const handleUpdateTask = async (taskData: any) => {
    try {
      if (!editingTask) return

      const priorityMap = { 'low': 0, 'medium': 1, 'high': 2 }
      const statusMap = { 'backlog': 0, 'todo': 0, 'in-progress': 1, 'done': 2 }

      const updateData = {
        title: taskData.title,
        description: taskData.description,
        priority: typeof taskData.priority === 'string' ? priorityMap[taskData.priority as keyof typeof priorityMap] : taskData.priority,
        status: typeof taskData.status === 'string' ? statusMap[taskData.status as keyof typeof statusMap] : taskData.status,
        assignedTo: taskData.assignedTo === 'unassigned' ? null : taskData.assignedTo || null,
        dueDate: taskData.dueDate ? new Date(taskData.dueDate) : null
      }

      await updateTask(editingTask.id, updateData)
      setIsEditDialogOpen(false)
      setEditingTask(null)
    } catch (err) {
      alert('Failed to update task')
    }
  }

  // Get filtered tasks based on current filters
  const getFilteredTasks = () => {
    let filteredTasks = tasks

    // Apply status filter
    if (selectedFilter !== "all") {
      filteredTasks = getTasksByStatus(selectedFilter)
    }

    // Apply team filter (you can extend this based on your team data)
    if (selectedTeamFilter !== "all") {
      // Add team filtering logic here when you have team data
    }

    return filteredTasks
  }

  const filteredTasks = getFilteredTasks()

  return (
    <div className="flex h-[calc(100vh-112px)] md:h-[calc(100vh-56px)] overflow-hidden">
      {/* Tasks Sidebar */}
      <div className="w-64 flex-col bg-gray-50 border-r dark:bg-gray-900 md:flex hidden">
        <div className="flex h-12 items-center border-b px-4">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2 font-medium text-sm text-muted-foreground">Task Overview</div>
          </div>
        </div>
        <div className="flex-1 overflow-auto py-2">
          <div className="px-3 py-2">
            <div className="space-y-3">
              <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Quick Stats</div>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 rounded bg-gray-100 dark:bg-gray-800">
                  <span className="text-sm">Total Tasks</span>
                  <Badge variant="secondary">{tasks.length}</Badge>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-yellow-50 dark:bg-yellow-900/20">
                  <span className="text-sm">In Progress</span>
                  <Badge variant="secondary">
                    {tasks.filter(t => t.status === 1 || t.status === 'in-progress').length}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-2 rounded bg-green-50 dark:bg-green-900/20">
                  <span className="text-sm">Completed</span>
                  <Badge variant="secondary">
                    {tasks.filter(t => t.status === 2 || t.status === 'done').length}
                  </Badge>
                </div>
              </div>

              <div className="text-xs font-semibold text-gray-500 uppercase mb-2 mt-4">My Tasks</div>
              <div className="space-y-1">
                {tasks.filter(t => t.assignee?.id === user?.id).slice(0, 5).map(task => (
                  <div key={task.id} className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer">
                    <div className="text-sm font-medium truncate">{task.title}</div>
                    <div className="text-xs text-gray-500 flex items-center gap-1">
                      <Flag className={`h-3 w-3 ${(task.priority === 2 || task.priority === 'high') ? 'text-red-500' :
                          (task.priority === 1 || task.priority === 'medium') ? 'text-yellow-500' :
                            'text-blue-500'
                        }`} />
                      {typeof task.priority === 'number'
                        ? (task.priority === 2 ? 'High' : task.priority === 1 ? 'Medium' : 'Low')
                        : task.priority
                      }
                    </div>
                  </div>
                ))}
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* Main Tasks Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile Sidebar Toggle */}
        <div className="md:hidden p-2 border-b bg-background">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={() => {
              // Toggle mobile sidebar
            }}
          >
            <Menu className="h-4 w-4 mr-2" />
            Task Overview
          </Button>
        </div>

        {/* Header */}
        <header className="flex h-12 items-center justify-between border-b bg-white px-4 dark:bg-gray-950">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">Tasks</h1>
            {isLoading && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <RefreshCw className="h-3 w-3 animate-spin" />
                <span>Syncing...</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative hidden sm:block">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500 dark:text-gray-400" />
              <Input type="search" placeholder="Search tasks" className="w-48 pl-8 text-sm" />
            </div>
            <Button variant="outline" size="sm" className="gap-1" onClick={refreshTasks}>
              <RefreshCw className="h-4 w-4" />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button variant="outline" size="sm" className="gap-1">
              <Filter className="h-4 w-4" />
              <span className="hidden sm:inline">Filter</span>
            </Button>
            <Dialog open={isNewIssueDialogOpen} onOpenChange={(open) => {
              setIsNewIssueDialogOpen(open)
              if (!open) {
                // Reset states when dialog is closed
                setIsCreatingTask(false)
                setKeepDialogOpen(false)
                setShowSuccessMessage(false)
              }
            }}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1">
                  <Plus className="h-4 w-4" />
                  New Task
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-[95vw] sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create New Task</DialogTitle>
                  <DialogDescription>Fill in the details to create a new task.</DialogDescription>
                </DialogHeader>

                {/* Success message */}
                {showSuccessMessage && (
                  <div className="bg-green-50 border border-green-200 rounded-md p-3 mb-4">
                    <div className="flex items-center">
                      <CheckCircle2 className="h-4 w-4 text-green-600 mr-2" />
                      <span className="text-sm font-medium text-green-800">
                        Task created successfully!
                      </span>
                    </div>
                  </div>
                )}

                <div className="grid gap-4 py-4 px-1">
                  <div className="grid gap-2">
                    <Label htmlFor="issue-title">Title *</Label>
                    <Input
                      id="issue-title"
                      placeholder="Enter task title"
                      value={newTaskForm.title}
                      onChange={(e) => handleFormChange('title', e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="issue-description">Description</Label>
                    <Textarea
                      id="issue-description"
                      placeholder="Describe the task in detail"
                      rows={4}
                      value={newTaskForm.description}
                      onChange={(e) => handleFormChange('description', e.target.value)}
                    />
                  </div>

                  {/* Organization selector */}
                  <div className="grid gap-2">
                    <Label htmlFor="issue-organization">Organization</Label>
                    <Select
                      value={newTaskForm.organizationId}
                      onValueChange={(value) => handleFormChange('organizationId', value)}
                    >
                      <SelectTrigger id="issue-organization">
                        <SelectValue placeholder="Select organization" />
                      </SelectTrigger>
                      <SelectContent>
                        {organizations.map(org => (
                          <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Multiple teams selector */}
                  <div className="grid gap-2">
                    <Label htmlFor="issue-teams">Teams (can select multiple)</Label>
                    <Select onValueChange={addTeamToTask}>
                      <SelectTrigger id="issue-teams">
                        <SelectValue placeholder="Select teams" />
                      </SelectTrigger>
                      <SelectContent>
                        {teams.filter(team => !newTaskForm.teamIds.includes(team.id)).map(team => (
                          <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {newTaskForm.teamIds.map(teamId => {
                        const team = teams.find(t => t.id === teamId)
                        return team ? (
                          <Badge key={teamId} variant="outline" className="bg-blue-100 text-blue-800 border-blue-200">
                            {team.name}
                            <button
                              className="ml-1 text-blue-600 hover:text-blue-800"
                              onClick={() => removeTeamFromTask(teamId)}
                            >
                              &times;
                            </button>
                          </Badge>
                        ) : null
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="issue-type">Type</Label>
                      <Select
                        value={newTaskForm.type}
                        onValueChange={(value) => handleFormChange('type', value)}
                      >
                        <SelectTrigger id="issue-type">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          {getEnumOptions.TaskType().map(option => (
                            <SelectItem key={option.value} value={option.value.toString()}>
                              {getEnumIcon.TaskType(option.value)} {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="issue-priority">Priority</Label>
                      <Select
                        value={newTaskForm.priority}
                        onValueChange={(value) => handleFormChange('priority', value)}
                      >
                        <SelectTrigger id="issue-priority">
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                        <SelectContent>
                          {getEnumOptions.TaskPriority().map(option => (
                            <SelectItem key={option.value} value={option.value.toString()}>
                              {getEnumIcon.TaskPriority(option.value)} {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="issue-assignee">Assignee</Label>
                      <Select
                        value={newTaskForm.assignedTo}
                        onValueChange={(value) => handleFormChange('assignedTo', value)}
                      >
                        <SelectTrigger id="issue-assignee">
                          <SelectValue placeholder="Select assignee" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {user && (
                            <SelectItem value={user.id}>{user.name} (You)</SelectItem>
                          )}
                          {teamMembers.map(member => (
                            <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="issue-status">Status</Label>
                      <Select
                        value={newTaskForm.status}
                        onValueChange={(value) => handleFormChange('status', value)}
                      >
                        <SelectTrigger id="issue-status">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          {getEnumOptions.TaskStatus().map(option => (
                            <SelectItem key={option.value} value={option.value.toString()}>
                              {getEnumIcon.TaskStatus(option.value)} {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Due Date */}
                  <div className="grid gap-2">
                    <Label htmlFor="issue-due-date">Due Date</Label>
                    <Input
                      id="issue-due-date"
                      type="date"
                      value={newTaskForm.dueDate}
                      onChange={(e) => handleFormChange('dueDate', e.target.value)}
                    />
                  </div>
                </div>

                {/* Keep dialog open checkbox */}
                <div className="flex items-center space-x-2 pt-4 border-t">
                  <Checkbox
                    id="keep-dialog-open"
                    checked={keepDialogOpen}
                    onCheckedChange={setKeepDialogOpen}
                  />
                  <label
                    htmlFor="keep-dialog-open"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Keep dialog open after creating task
                  </label>
                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsNewIssueDialogOpen(false)
                      setIsCreatingTask(false)
                      setKeepDialogOpen(false)
                      setShowSuccessMessage(false)
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateTask}
                    disabled={isCreatingTask}
                    className="min-w-[100px]"
                  >
                    {isCreatingTask ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Create Task'
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Edit Task Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
              <DialogContent className="max-w-[95vw] sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Edit Task</DialogTitle>
                  <DialogDescription>Update the task details.</DialogDescription>
                </DialogHeader>
                {editingTask && (
                  <EditTaskForm
                    task={editingTask}
                    teams={teams}
                    organizations={organizations}
                    users={[user, ...teamMembers].filter(Boolean)}
                    onSave={handleUpdateTask}
                    onCancel={() => setIsEditDialogOpen(false)}
                  />
                )}
              </DialogContent>
            </Dialog>
          </div>
        </header>

        {/* Main Content Area */}
        <div className="flex-1 overflow-auto p-4">
          {isLoading ? (
            <div className="flex justify-center items-center h-full">
              <p>Loading tasks...</p>
            </div>
          ) : error ? (
            <div className="flex justify-center items-center h-full">
              <p className="text-red-500">Error loading tasks: {error.message}</p>
            </div>
          ) : (
            <Tabs defaultValue="board">
              {/* Make the tablist in tasks more mobile-friendly */}
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <TabsList className="h-auto p-1">
                  <TabsTrigger
                    value="board"
                    className="flex items-center gap-1 px-2 py-1 h-8 text-xs sm:text-sm sm:px-3 sm:py-1.5 sm:h-9 sm:gap-2"
                  >
                    <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4" />
                    <span>Board</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="list"
                    className="flex items-center gap-1 px-2 py-1 h-8 text-xs sm:text-sm sm:px-3 sm:py-1.5 sm:h-9 sm:gap-2"
                  >
                    <ArrowUpDown className="h-3 w-3 sm:h-4 sm:w-4" />
                    <span>List</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="calendar"
                    className="flex items-center gap-1 px-2 py-1 h-8 text-xs sm:text-sm sm:px-3 sm:py-1.5 sm:h-9 sm:gap-2"
                  >
                    <Calendar className="h-3 w-3 sm:h-4 sm:w-4" />
                    <span>Calendar</span>
                  </TabsTrigger>
                </TabsList>
                <div className="flex items-center gap-2 flex-wrap">
                  <Select value={selectedFilter} onValueChange={setSelectedFilter}>
                    <SelectTrigger className="w-[120px] sm:w-[180px] h-8 text-xs">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="backlog">Backlog</SelectItem>
                      <SelectItem value="todo">To Do</SelectItem>
                      <SelectItem value="in-progress">In Progress</SelectItem>
                      <SelectItem value="review">In Review</SelectItem>
                      <SelectItem value="done">Done</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={selectedTeamFilter} onValueChange={setSelectedTeamFilter}>
                    <SelectTrigger className="w-[120px] sm:w-[180px] h-8 text-xs">
                      <SelectValue placeholder="Team" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Teams</SelectItem>
                      <SelectItem value="me">Assigned to me</SelectItem>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Board View */}
              <TabsContent value="board" className="mt-0">
                {/* Mobile View - Single column with sections */}
                <div className="md:hidden space-y-6">
                  {[
                    { status: [TaskStatus.BACKLOG], title: 'Backlog', color: 'bg-gray-400', bgColor: 'bg-gray-100', textColor: 'text-gray-800', borderColor: 'border-gray-200' },
                    { status: [TaskStatus.TODO], title: 'To Do', color: 'bg-blue-400', bgColor: 'bg-blue-100', textColor: 'text-blue-800', borderColor: 'border-blue-200' },
                    { status: [TaskStatus.IN_PROGRESS], title: 'In Progress', color: 'bg-yellow-400', bgColor: 'bg-yellow-100', textColor: 'text-yellow-800', borderColor: 'border-yellow-200' },
                    { status: [TaskStatus.IN_REVIEW], title: 'In Review', color: 'bg-purple-400', bgColor: 'bg-purple-100', textColor: 'text-purple-800', borderColor: 'border-purple-200' },
                    { status: [TaskStatus.DONE], title: 'Done', color: 'bg-green-400', bgColor: 'bg-green-100', textColor: 'text-green-800', borderColor: 'border-green-200' }
                  ].map(section => {
                    const sectionTasks = filteredTasks.filter(task =>
                      section.status.includes(task.status)
                    )

                    if (sectionTasks.length === 0) return null

                    return (
                      <div key={section.title} className="space-y-3">
                        <div className="flex items-center gap-2 sticky top-0 bg-background py-2 z-10">
                          <div className={`h-2.5 w-2.5 rounded-full ${section.color}`}></div>
                          <h3 className="font-medium">{section.title}</h3>
                          <span className="text-xs text-gray-500">({sectionTasks.length})</span>
                        </div>
                        <div className="space-y-3">
                          {sectionTasks.map(task => (
                            <Card key={task.id} className="shadow-sm">
                              <CardContent className="p-3">
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <Badge variant="outline" className={getEnumStyles.TaskType(task.type)}>
                                      {getEnumIcon.TaskType(task.type)} {getEnumLabel.TaskType(task.type)}
                                    </Badge>
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-7 w-7">
                                          <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => handleEditTask(task)}>
                                          Edit Task
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => handleQuickStatusChange(task.id, TaskStatus.BACKLOG)}>
                                          Move to Backlog
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleQuickStatusChange(task.id, TaskStatus.IN_PROGRESS)}>
                                          Move to In Progress
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleQuickStatusChange(task.id, TaskStatus.DONE)}>
                                          Mark as Complete
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => handleQuickPriorityChange(task.id, TaskPriority.HIGH)}>
                                          Set High Priority
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleQuickPriorityChange(task.id, TaskPriority.MEDIUM)}>
                                          Set Medium Priority
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleQuickPriorityChange(task.id, TaskPriority.LOW)}>
                                          Set Low Priority
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => handleQuickAssign(task.id, user?.id || null)}>
                                          Assign to Me
                                        </DropdownMenuItem>
                                        {teamMembers.slice(0, 3).map(member => (
                                          <DropdownMenuItem key={member.id} onClick={() => handleQuickAssign(task.id, member.id)}>
                                            Assign to {member.name}
                                          </DropdownMenuItem>
                                        ))}
                                        <DropdownMenuItem onClick={() => handleQuickAssign(task.id, null)}>
                                          Unassign
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                          className="text-red-600"
                                          onClick={() => deleteTask(task.id)}
                                        >
                                          Delete
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-medium flex-1">{task.title}</h4>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0"
                                      onClick={() => {
                                        const currentStatus = typeof task.status === 'number' ? task.status :
                                          (task.status === 'done' ? 2 : task.status === 'in-progress' ? 1 : 0)
                                        const nextStatus = currentStatus === 2 ? 0 : currentStatus + 1
                                        handleQuickStatusChange(task.id, nextStatus)
                                      }}
                                      title="Click to advance status"
                                    >
                                      {(task.status === 2 || task.status === 'done') ? (
                                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                                      ) : (task.status === 1 || task.status === 'in-progress') ? (
                                        <Clock className="h-4 w-4 text-yellow-600" />
                                      ) : (
                                        <Circle className="h-4 w-4 text-gray-400" />
                                      )}
                                    </Button>
                                  </div>

                                  {/* Quick Action Buttons */}
                                  <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
                                    <div className="flex items-center gap-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 px-2 text-xs"
                                        onClick={() => handleEditTask(task)}
                                        title="Edit task"
                                      >
                                        <Edit className="h-3 w-3 mr-1" />
                                        Edit
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 px-2 text-xs"
                                        onClick={() => handleQuickAssign(task.id, user?.id || null)}
                                        title="Assign to me"
                                      >
                                        <UserPlus className="h-3 w-3 mr-1" />
                                        Assign
                                      </Button>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                        onClick={() => deleteTask(task.id)}
                                        title="Delete task"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                  <p className="text-sm text-gray-500">{task.description}</p>
                                  {/* Organization badge */}
                                  {task.organization && (
                                    <div className="flex items-center gap-1 mb-1">
                                      <div className="flex items-center gap-1">
                                        <div className="h-2 w-2 rounded-full bg-purple-400" />
                                        <span className="text-xs text-gray-600">{task.organization.name}</span>
                                      </div>
                                    </div>
                                  )}

                                  {/* Teams */}
                                  {task.teams && task.teams.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mb-1">
                                      {task.teams.map(team => (
                                        <Badge key={team.id} variant="outline" className="bg-blue-50 text-blue-700 border-blue-100 text-xs py-0">
                                          {team.name}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}

                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-auto p-0 hover:bg-transparent"
                                        onClick={() => {
                                          const currentPriority = typeof task.priority === 'number' ? task.priority :
                                            (task.priority === 'high' ? 2 : task.priority === 'medium' ? 1 : 0)
                                          const nextPriority = currentPriority === 2 ? 0 : currentPriority + 1
                                          handleQuickPriorityChange(task.id, nextPriority)
                                        }}
                                        title="Click to change priority"
                                      >
                                        <Flag className={`h-3 w-3 ${(task.priority === 2 || task.priority === 'high') ? 'text-red-500' :
                                            (task.priority === 1 || task.priority === 'medium') ? 'text-yellow-500' :
                                              'text-blue-500'
                                          }`} />
                                        <span className="text-xs ml-1">
                                          {typeof task.priority === 'number'
                                            ? (task.priority === 2 ? 'High' : task.priority === 1 ? 'Medium' : 'Low')
                                            : task.priority
                                          }
                                        </span>
                                      </Button>
                                    </div>
                                    {task.id && (
                                      <div className="flex items-center gap-1">
                                        <Tag className="h-3 w-3" />
                                        <span className="text-xs">{task.id.substring(0, 8)}</span>
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex items-center justify-between">
                                    {task.dueDate && (
                                      <div className="flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        <span className="text-xs">
                                          {new Date(task.dueDate).toLocaleDateString()}
                                        </span>
                                      </div>
                                    )}
                                    {task.assignee && (
                                      <Avatar className="h-6 w-6">
                                        <AvatarImage
                                          src={task.assignee.avatarUrl || "/placeholder-user.jpg"}
                                          alt={task.assignee.name}
                                        />
                                        <AvatarFallback>
                                          {task.assignee.name.substring(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                      </Avatar>
                                    )}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Desktop View - Column layout */}
                <div className="hidden md:grid md:grid-cols-3 lg:grid-cols-4 gap-4 md:h-[calc(100vh-220px)]">
                  {/* Backlog Column */}
                  <div className="space-y-4 flex flex-col">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full bg-gray-400"></div>
                        <h3 className="font-medium">Backlog</h3>
                        <span className="text-xs text-gray-500">
                          {filteredTasks.filter(task => task.status === 0 || task.status === 'backlog').length}
                        </span>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex-1 overflow-auto md:max-h-[calc(100vh-280px)]">
                      <div className="space-y-3 pr-2">
                        {filteredTasks
                          .filter(task => task.status === 0 || task.status === 'backlog')
                          .map(task => (
                            <Card key={task.id} className="shadow-sm">
                              <CardContent className="p-3">
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200">
                                      {task.type || 'Task'}
                                    </Badge>
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-7 w-7">
                                          <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => handleEditTask(task)}>
                                          Edit Task
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />

                                        {/* Status submenu */}
                                        <DropdownMenuItem onClick={() => handleQuickStatusChange(task.id, TaskStatus.BACKLOG)}>
                                          Move to Backlog
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleQuickStatusChange(task.id, TaskStatus.IN_PROGRESS)}>
                                          Move to In Progress
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleQuickStatusChange(task.id, TaskStatus.DONE)}>
                                          Mark as Complete
                                        </DropdownMenuItem>

                                        <DropdownMenuSeparator />

                                        {/* Priority submenu */}
                                        <DropdownMenuItem onClick={() => handleQuickPriorityChange(task.id, TaskPriority.HIGH)}>
                                          Set High Priority
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleQuickPriorityChange(task.id, TaskPriority.MEDIUM)}>
                                          Set Medium Priority
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleQuickPriorityChange(task.id, TaskPriority.LOW)}>
                                          Set Low Priority
                                        </DropdownMenuItem>

                                        <DropdownMenuSeparator />

                                        {/* Assignment */}
                                        <DropdownMenuItem onClick={() => handleQuickAssign(task.id, user?.id || null)}>
                                          Assign to Me
                                        </DropdownMenuItem>
                                        {teamMembers.slice(0, 3).map(member => (
                                          <DropdownMenuItem key={member.id} onClick={() => handleQuickAssign(task.id, member.id)}>
                                            Assign to {member.name}
                                          </DropdownMenuItem>
                                        ))}
                                        <DropdownMenuItem onClick={() => handleQuickAssign(task.id, null)}>
                                          Unassign
                                        </DropdownMenuItem>

                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                          className="text-red-600"
                                          onClick={() => deleteTask(task.id)}
                                        >
                                          Delete
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-medium flex-1">{task.title}</h4>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0"
                                      onClick={() => {
                                        const currentStatus = typeof task.status === 'number' ? task.status :
                                          (task.status === 'done' ? 2 : task.status === 'in-progress' ? 1 : 0)
                                        const nextStatus = currentStatus === 2 ? 0 : currentStatus + 1
                                        handleQuickStatusChange(task.id, nextStatus)
                                      }}
                                      title="Click to advance status"
                                    >
                                      {(task.status === 2 || task.status === 'done') ? (
                                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                                      ) : (task.status === 1 || task.status === 'in-progress') ? (
                                        <Clock className="h-4 w-4 text-yellow-600" />
                                      ) : (
                                        <Circle className="h-4 w-4 text-gray-400" />
                                      )}
                                    </Button>
                                  </div>

                                  {/* Quick Action Buttons */}
                                  <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
                                    <div className="flex items-center gap-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 px-2 text-xs"
                                        onClick={() => handleEditTask(task)}
                                        title="Edit task"
                                      >
                                        <Edit className="h-3 w-3 mr-1" />
                                        Edit
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 px-2 text-xs"
                                        onClick={() => handleQuickAssign(task.id, user?.id || null)}
                                        title="Assign to me"
                                      >
                                        <UserPlus className="h-3 w-3 mr-1" />
                                        Assign
                                      </Button>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                        onClick={() => deleteTask(task.id)}
                                        title="Delete task"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                  <p className="text-sm text-gray-500">{task.description}</p>
                                  {/* Organization badge */}
                                  {task.organization && (
                                    <div className="flex items-center gap-1 mb-1">
                                      <div className="flex items-center gap-1">
                                        <div className="h-2 w-2 rounded-full bg-purple-400" />
                                        <span className="text-xs text-gray-600">{task.organization.name}</span>
                                      </div>
                                    </div>
                                  )}

                                  {/* Teams */}
                                  {task.teams && task.teams.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mb-1">
                                      {task.teams.map(team => (
                                        <Badge key={team.id} variant="outline" className="bg-blue-50 text-blue-700 border-blue-100 text-xs py-0">
                                          {team.name}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}

                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-auto p-0 hover:bg-transparent"
                                        onClick={() => {
                                          const currentPriority = typeof task.priority === 'number' ? task.priority :
                                            (task.priority === 'high' ? 2 : task.priority === 'medium' ? 1 : 0)
                                          const nextPriority = currentPriority === 2 ? 0 : currentPriority + 1
                                          handleQuickPriorityChange(task.id, nextPriority)
                                        }}
                                        title="Click to change priority"
                                      >
                                        <Flag className={`h-3 w-3 ${(task.priority === 2 || task.priority === 'high') ? 'text-red-500' :
                                            (task.priority === 1 || task.priority === 'medium') ? 'text-yellow-500' :
                                              'text-blue-500'
                                          }`} />
                                        <span className="text-xs ml-1">
                                          {typeof task.priority === 'number'
                                            ? (task.priority === 2 ? 'High' : task.priority === 1 ? 'Medium' : 'Low')
                                            : task.priority
                                          }
                                        </span>
                                      </Button>
                                    </div>
                                    {task.id && (
                                      <div className="flex items-center gap-1">
                                        <Tag className="h-3 w-3" />
                                        <span className="text-xs">{task.id.substring(0, 8)}</span>
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex items-center justify-between">
                                    {task.dueDate && (
                                      <div className="flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        <span className="text-xs">
                                          {new Date(task.dueDate).toLocaleDateString()}
                                        </span>
                                      </div>
                                    )}
                                    {task.assignee && (
                                      <Avatar className="h-6 w-6">
                                        <AvatarImage
                                          src={task.assignee.avatarUrl || "/placeholder-user.jpg"}
                                          alt={task.assignee.name}
                                        />
                                        <AvatarFallback>
                                          {task.assignee.name.substring(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                      </Avatar>
                                    )}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                      </div>
                    </div>
                  </div>

                  {/* Todo Column */}
                  <div className="space-y-4 flex flex-col">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full bg-blue-400"></div>
                        <h3 className="font-medium">To Do</h3>
                        <span className="text-xs text-gray-500">
                          {filteredTasks.filter(task => task.status === 'todo').length}
                        </span>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex-1 overflow-auto md:max-h-[calc(100vh-280px)]">
                      <div className="space-y-3 pr-2">
                        {filteredTasks
                          .filter(task => task.status === 'todo')
                          .map(task => (
                            <Card key={task.id} className="shadow-sm">
                              <CardContent className="p-3">
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200">
                                      {task.type || 'Task'}
                                    </Badge>
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-7 w-7">
                                          <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => handleEditTask(task)}>
                                          Edit Task
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => handleQuickStatusChange(task.id, TaskStatus.BACKLOG)}>
                                          Move to Backlog
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleQuickStatusChange(task.id, TaskStatus.IN_PROGRESS)}>
                                          Move to In Progress
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleQuickStatusChange(task.id, TaskStatus.DONE)}>
                                          Mark as Complete
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => handleQuickPriorityChange(task.id, TaskPriority.HIGH)}>
                                          Set High Priority
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleQuickPriorityChange(task.id, TaskPriority.MEDIUM)}>
                                          Set Medium Priority
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleQuickPriorityChange(task.id, TaskPriority.LOW)}>
                                          Set Low Priority
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => handleQuickAssign(task.id, user?.id || null)}>
                                          Assign to Me
                                        </DropdownMenuItem>
                                        {teamMembers.slice(0, 3).map(member => (
                                          <DropdownMenuItem key={member.id} onClick={() => handleQuickAssign(task.id, member.id)}>
                                            Assign to {member.name}
                                          </DropdownMenuItem>
                                        ))}
                                        <DropdownMenuItem onClick={() => handleQuickAssign(task.id, null)}>
                                          Unassign
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                          className="text-red-600"
                                          onClick={() => deleteTask(task.id)}
                                        >
                                          Delete
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-medium flex-1">{task.title}</h4>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0"
                                      onClick={() => {
                                        const currentStatus = typeof task.status === 'number' ? task.status :
                                          (task.status === 'done' ? 2 : task.status === 'in-progress' ? 1 : 0)
                                        const nextStatus = currentStatus === 2 ? 0 : currentStatus + 1
                                        handleQuickStatusChange(task.id, nextStatus)
                                      }}
                                      title="Click to advance status"
                                    >
                                      {(task.status === 2 || task.status === 'done') ? (
                                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                                      ) : (task.status === 1 || task.status === 'in-progress') ? (
                                        <Clock className="h-4 w-4 text-yellow-600" />
                                      ) : (
                                        <Circle className="h-4 w-4 text-gray-400" />
                                      )}
                                    </Button>
                                  </div>

                                  {/* Quick Action Buttons */}
                                  <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
                                    <div className="flex items-center gap-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 px-2 text-xs"
                                        onClick={() => handleEditTask(task)}
                                        title="Edit task"
                                      >
                                        <Edit className="h-3 w-3 mr-1" />
                                        Edit
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 px-2 text-xs"
                                        onClick={() => handleQuickAssign(task.id, user?.id || null)}
                                        title="Assign to me"
                                      >
                                        <UserPlus className="h-3 w-3 mr-1" />
                                        Assign
                                      </Button>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                        onClick={() => deleteTask(task.id)}
                                        title="Delete task"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                  <p className="text-sm text-gray-500">{task.description}</p>
                                  <div className="flex items-center justify-between">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-auto p-0 hover:bg-transparent"
                                      onClick={() => {
                                        const currentPriority = typeof task.priority === 'number' ? task.priority :
                                          (task.priority === 'high' ? 2 : task.priority === 'medium' ? 1 : 0)
                                        const nextPriority = currentPriority === 2 ? 0 : currentPriority + 1
                                        handleQuickPriorityChange(task.id, nextPriority)
                                      }}
                                      title="Click to change priority"
                                    >
                                      <Flag className={`h-3 w-3 ${(task.priority === 2 || task.priority === 'high') ? 'text-red-500' :
                                          (task.priority === 1 || task.priority === 'medium') ? 'text-yellow-500' :
                                            'text-blue-500'
                                        }`} />
                                      <span className="text-xs ml-1">
                                        {typeof task.priority === 'number'
                                          ? (task.priority === 2 ? 'High' : task.priority === 1 ? 'Medium' : 'Low')
                                          : task.priority
                                        }
                                      </span>
                                    </Button>
                                    {task.assignee && (
                                      <Avatar className="h-6 w-6">
                                        <AvatarImage
                                          src={task.assignee.avatarUrl || "/placeholder-user.jpg"}
                                          alt={task.assignee.name}
                                        />
                                        <AvatarFallback>
                                          {task.assignee.name.substring(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                      </Avatar>
                                    )}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                      </div>
                    </div>
                  </div>

                  {/* In Progress Column */}
                  <div className="space-y-4 flex flex-col">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full bg-yellow-400"></div>
                        <h3 className="font-medium">In Progress</h3>
                        <span className="text-xs text-gray-500">
                          {filteredTasks.filter(task => task.status === 1 || task.status === 'in-progress').length}
                        </span>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex-1 overflow-auto md:max-h-[calc(100vh-280px)]">
                      <div className="space-y-3 pr-2">
                        {filteredTasks
                          .filter(task => task.status === 1 || task.status === 'in-progress')
                          .map(task => (
                            <Card key={task.id} className="shadow-sm">
                              <CardContent className="p-3">
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-200">
                                      {task.type || 'Task'}
                                    </Badge>
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-7 w-7">
                                          <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => handleEditTask(task)}>
                                          Edit Task
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => handleQuickStatusChange(task.id, TaskStatus.BACKLOG)}>
                                          Move to Backlog
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleQuickStatusChange(task.id, TaskStatus.IN_PROGRESS)}>
                                          Move to In Progress
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleQuickStatusChange(task.id, TaskStatus.DONE)}>
                                          Mark as Complete
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => handleQuickPriorityChange(task.id, TaskPriority.HIGH)}>
                                          Set High Priority
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleQuickPriorityChange(task.id, TaskPriority.MEDIUM)}>
                                          Set Medium Priority
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleQuickPriorityChange(task.id, TaskPriority.LOW)}>
                                          Set Low Priority
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => handleQuickAssign(task.id, user?.id || null)}>
                                          Assign to Me
                                        </DropdownMenuItem>
                                        {teamMembers.slice(0, 3).map(member => (
                                          <DropdownMenuItem key={member.id} onClick={() => handleQuickAssign(task.id, member.id)}>
                                            Assign to {member.name}
                                          </DropdownMenuItem>
                                        ))}
                                        <DropdownMenuItem onClick={() => handleQuickAssign(task.id, null)}>
                                          Unassign
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                          className="text-red-600"
                                          onClick={() => deleteTask(task.id)}
                                        >
                                          Delete
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-medium flex-1">{task.title}</h4>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0"
                                      onClick={() => {
                                        const currentStatus = typeof task.status === 'number' ? task.status :
                                          (task.status === 'done' ? 2 : task.status === 'in-progress' ? 1 : 0)
                                        const nextStatus = currentStatus === 2 ? 0 : currentStatus + 1
                                        handleQuickStatusChange(task.id, nextStatus)
                                      }}
                                      title="Click to advance status"
                                    >
                                      {(task.status === 2 || task.status === 'done') ? (
                                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                                      ) : (task.status === 1 || task.status === 'in-progress') ? (
                                        <Clock className="h-4 w-4 text-yellow-600" />
                                      ) : (
                                        <Circle className="h-4 w-4 text-gray-400" />
                                      )}
                                    </Button>
                                  </div>

                                  {/* Quick Action Buttons */}
                                  <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
                                    <div className="flex items-center gap-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 px-2 text-xs"
                                        onClick={() => handleEditTask(task)}
                                        title="Edit task"
                                      >
                                        <Edit className="h-3 w-3 mr-1" />
                                        Edit
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 px-2 text-xs"
                                        onClick={() => handleQuickAssign(task.id, user?.id || null)}
                                        title="Assign to me"
                                      >
                                        <UserPlus className="h-3 w-3 mr-1" />
                                        Assign
                                      </Button>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                        onClick={() => deleteTask(task.id)}
                                        title="Delete task"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                  <p className="text-sm text-gray-500">{task.description}</p>
                                  <div className="flex items-center justify-between">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-auto p-0 hover:bg-transparent"
                                      onClick={() => {
                                        const currentPriority = typeof task.priority === 'number' ? task.priority :
                                          (task.priority === 'high' ? 2 : task.priority === 'medium' ? 1 : 0)
                                        const nextPriority = currentPriority === 2 ? 0 : currentPriority + 1
                                        handleQuickPriorityChange(task.id, nextPriority)
                                      }}
                                      title="Click to change priority"
                                    >
                                      <Flag className={`h-3 w-3 ${(task.priority === 2 || task.priority === 'high') ? 'text-red-500' :
                                          (task.priority === 1 || task.priority === 'medium') ? 'text-yellow-500' :
                                            'text-blue-500'
                                        }`} />
                                      <span className="text-xs ml-1">
                                        {typeof task.priority === 'number'
                                          ? (task.priority === 2 ? 'High' : task.priority === 1 ? 'Medium' : 'Low')
                                          : task.priority
                                        }
                                      </span>
                                    </Button>
                                    {task.assignee && (
                                      <Avatar className="h-6 w-6">
                                        <AvatarImage
                                          src={task.assignee.avatarUrl || "/placeholder-user.jpg"}
                                          alt={task.assignee.name}
                                        />
                                        <AvatarFallback>
                                          {task.assignee.name.substring(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                      </Avatar>
                                    )}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                      </div>
                    </div>
                  </div>

                  {/* Done Column */}
                  <div className="space-y-4 flex flex-col">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full bg-green-400"></div>
                        <h3 className="font-medium">Done</h3>
                        <span className="text-xs text-gray-500">
                          {filteredTasks.filter(task => task.status === 2 || task.status === 'done').length}
                        </span>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex-1 overflow-auto md:max-h-[calc(100vh-280px)]">
                      <div className="space-y-3 pr-2">
                        {filteredTasks
                          .filter(task => task.status === 2 || task.status === 'done')
                          .map(task => (
                            <Card key={task.id} className="shadow-sm">
                              <CardContent className="p-3">
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">
                                      {task.type || 'Task'}
                                    </Badge>
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-7 w-7">
                                          <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => handleEditTask(task)}>
                                          Edit Task
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => handleQuickStatusChange(task.id, TaskStatus.BACKLOG)}>
                                          Move to Backlog
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleQuickStatusChange(task.id, TaskStatus.IN_PROGRESS)}>
                                          Move to In Progress
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleQuickStatusChange(task.id, TaskStatus.DONE)}>
                                          Mark as Complete
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => handleQuickPriorityChange(task.id, TaskPriority.HIGH)}>
                                          Set High Priority
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleQuickPriorityChange(task.id, TaskPriority.MEDIUM)}>
                                          Set Medium Priority
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleQuickPriorityChange(task.id, TaskPriority.LOW)}>
                                          Set Low Priority
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => handleQuickAssign(task.id, user?.id || null)}>
                                          Assign to Me
                                        </DropdownMenuItem>
                                        {teamMembers.slice(0, 3).map(member => (
                                          <DropdownMenuItem key={member.id} onClick={() => handleQuickAssign(task.id, member.id)}>
                                            Assign to {member.name}
                                          </DropdownMenuItem>
                                        ))}
                                        <DropdownMenuItem onClick={() => handleQuickAssign(task.id, null)}>
                                          Unassign
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                          className="text-red-600"
                                          onClick={() => deleteTask(task.id)}
                                        >
                                          Delete
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-medium flex-1">{task.title}</h4>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0"
                                      onClick={() => {
                                        const currentStatus = typeof task.status === 'number' ? task.status :
                                          (task.status === 'done' ? 2 : task.status === 'in-progress' ? 1 : 0)
                                        const nextStatus = currentStatus === 2 ? 0 : currentStatus + 1
                                        handleQuickStatusChange(task.id, nextStatus)
                                      }}
                                      title="Click to advance status"
                                    >
                                      {(task.status === 2 || task.status === 'done') ? (
                                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                                      ) : (task.status === 1 || task.status === 'in-progress') ? (
                                        <Clock className="h-4 w-4 text-yellow-600" />
                                      ) : (
                                        <Circle className="h-4 w-4 text-gray-400" />
                                      )}
                                    </Button>
                                  </div>

                                  {/* Quick Action Buttons */}
                                  <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
                                    <div className="flex items-center gap-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 px-2 text-xs"
                                        onClick={() => handleEditTask(task)}
                                        title="Edit task"
                                      >
                                        <Edit className="h-3 w-3 mr-1" />
                                        Edit
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 px-2 text-xs"
                                        onClick={() => handleQuickAssign(task.id, user?.id || null)}
                                        title="Assign to me"
                                      >
                                        <UserPlus className="h-3 w-3 mr-1" />
                                        Assign
                                      </Button>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                        onClick={() => deleteTask(task.id)}
                                        title="Delete task"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                  <p className="text-sm text-gray-500">{task.description}</p>
                                  <div className="flex items-center justify-between">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-auto p-0 hover:bg-transparent"
                                      onClick={() => {
                                        const currentPriority = typeof task.priority === 'number' ? task.priority :
                                          (task.priority === 'high' ? 2 : task.priority === 'medium' ? 1 : 0)
                                        const nextPriority = currentPriority === 2 ? 0 : currentPriority + 1
                                        handleQuickPriorityChange(task.id, nextPriority)
                                      }}
                                      title="Click to change priority"
                                    >
                                      <Flag className={`h-3 w-3 ${(task.priority === 2 || task.priority === 'high') ? 'text-red-500' :
                                          (task.priority === 1 || task.priority === 'medium') ? 'text-yellow-500' :
                                            'text-blue-500'
                                        }`} />
                                      <span className="text-xs ml-1">
                                        {typeof task.priority === 'number'
                                          ? (task.priority === 2 ? 'High' : task.priority === 1 ? 'Medium' : 'Low')
                                          : task.priority
                                        }
                                      </span>
                                    </Button>
                                    {task.assignee && (
                                      <Avatar className="h-6 w-6">
                                        <AvatarImage
                                          src={task.assignee.avatarUrl || "/placeholder-user.jpg"}
                                          alt={task.assignee.name}
                                        />
                                        <AvatarFallback>
                                          {task.assignee.name.substring(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                      </Avatar>
                                    )}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </div>
  )
}

export default function TasksPage() {
  return (
    <TasksProvider>
      <TasksContent />
    </TasksProvider>
  )
}