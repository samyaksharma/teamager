"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { CreateOrganizationCard } from "@/components/create-organization-card"
import { InvitationsCard } from "@/components/invitations-card"
import { AddTeamMemberDialog } from "@/components/add-team-member-dialog"
import {
  Calendar,
  MessageSquare,
  FileText,
  CheckSquare,
  Clock,
  Plus,
  Users,
  Hash,
} from "lucide-react"
import { useState, useEffect } from "react"
import { useAuth } from "@/lib/authContext"
import { tasksApi, channelsApi, documentsApi, teamApi } from "@/lib/api"
import { toast } from "sonner"

function TaskCardSkeleton() {
  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex justify-between items-start">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-5 w-16" />
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-3/4" />
      <div className="flex items-center space-x-1 mt-2">
        <Skeleton className="h-3 w-3 rounded" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <Tabs defaultValue="tasks">
      <div className="flex items-center justify-between mb-4">
        <TabsList>
          <TabsTrigger value="tasks" className="flex items-center gap-2">
            <CheckSquare className="h-4 w-4" />
            Tasks
          </TabsTrigger>
          <TabsTrigger value="messages" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Messages
          </TabsTrigger>
          <TabsTrigger value="docs" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Documents
          </TabsTrigger>
        </TabsList>
        {/* <Button size="sm" className="gap-1">
          <Plus className="h-4 w-4" />
          New
        </Button> */}
      </div>

      <TabsContent value="tasks" className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>To Do</CardTitle>
              <CardDescription>Tasks that need to be started</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <TaskCardSkeleton />
                <TaskCardSkeleton />
                <TaskCardSkeleton />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle>In Progress</CardTitle>
              <CardDescription>Tasks currently being worked on</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <TaskCardSkeleton />
                <TaskCardSkeleton />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Done</CardTitle>
              <CardDescription>Completed tasks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <TaskCardSkeleton />
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>
    </Tabs>
  )
}

export default function DashboardPage() {
  const [hasTeam, setHasTeam] = useState<boolean>(false)
  const [tasks, setTasks] = useState([])
  const [channels, setChannels] = useState([])
  const [documents, setDocuments] = useState([])
  const { user, isLoading, organizations, teams } = useAuth()
  const [dataLoaded, setDataLoaded] = useState(false)
  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false)
  const [selectedTeamForMember, setSelectedTeamForMember] = useState("")


  // Set hasTeam based on organizations and teams
  useEffect(() => {
    setHasTeam(organizations.length > 0 || teams.length > 0)
    if (organizations.length > 0 || teams.length > 0) {
      setDataLoaded(true)
    }
  }, [organizations, teams])

  // Fetch additional dashboard data (tasks, documents, channels)
  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!teams.length) return

      try {
        const [tasksResponse, documentsResponse] = await Promise.all([
          tasksApi.getAllTasks(),
          documentsApi.getAllDocuments()
        ])

        setTasks(Array.isArray(tasksResponse) ? tasksResponse : [])
        setDocuments(Array.isArray(documentsResponse) ? documentsResponse : [])

        // Fetch channels for all teams
        const allChannels = []
        for (const team of teams) {
          try {
            const teamChannels = await channelsApi.getAllChannels(team.id)
            allChannels.push(...teamChannels)
          } catch (err) {
          }
        }
        setChannels(allChannels)
      } catch (error) {
      }
    }

    fetchDashboardData()
  }, [teams])

  const handleMemberAdded = () => {
    // Refresh teams data if needed
  }


  return (
    <div className="flex-1 py-6 px-1 sm:px-6">
      {!dataLoaded ? (
        <DashboardSkeleton />
      ) : hasTeam === false ? (
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Welcome to Teamager!</h1>
            <p className="text-muted-foreground mt-2">Get started by creating your first organization or joining existing teams.</p>
          </div>
          <div className="grid gap-6">
            <InvitationsCard />
            <CreateOrganizationCard />
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="px-6 md:py-2">
              <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
              <p className="text-muted-foreground">
                Welcome back, {user?.name}! Here's what's happening with your teams.
              </p>
            </div>
          </div>

          {/* Stats Overview */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Users className="h-8 w-8 text-blue-600" />
                  <div className="ml-4">
                    <p className="text-2xl font-bold">{teams.length}</p>
                    <p className="text-sm text-muted-foreground">Active Teams</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <CheckSquare className="h-8 w-8 text-green-600" />
                  <div className="ml-4">
                    <p className="text-2xl font-bold">{tasks.filter((t: any) => t.status === 2).length}</p>
                    <p className="text-sm text-muted-foreground">Tasks Completed</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <FileText className="h-8 w-8 text-purple-600" />
                  <div className="ml-4">
                    <p className="text-2xl font-bold">{documents.length}</p>
                    <p className="text-sm text-muted-foreground">Documents</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <Clock className="h-8 w-8 text-red-600" />
                  <div className="ml-4">
                    <p className="text-2xl font-bold">
                      {tasks.filter((t: any) => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 2).length}
                    </p>
                    <p className="text-sm text-muted-foreground">Overdue Tasks</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content Tabs */}
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="tasks">My Tasks</TabsTrigger>
              <TabsTrigger value="activity">Recent Activity</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                {/* Recent Tasks */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckSquare className="h-5 w-5" />
                        Recent Tasks
                      </div>
                      <Link href="/dashboard/tasks">
                        <Button variant="ghost" size="sm" className="text-xs">
                          View All
                        </Button>
                      </Link>
                    </CardTitle>
                    <CardDescription>Your latest task updates</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {tasks.slice(0, 4).map((task: any) => (
                        <Link key={task.id} href="/dashboard/tasks" className="block">
                          <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                            <div className="flex items-center space-x-3">
                              <div className={`w-2 h-2 rounded-full ${task.status === 2 ? 'bg-green-500' :
                                task.status === 1 ? 'bg-yellow-500' : 'bg-gray-400'
                                }`} />
                              <div>
                                <p className="font-medium text-sm">{task.title}</p>
                                <p className="text-xs text-muted-foreground">
                                  {task.status === 2 ? 'Completed' :
                                    task.status === 1 ? 'In Progress' : 'To Do'}
                                </p>
                              </div>
                            </div>
                            <Badge variant={task.priority === 2 ? "destructive" : task.priority === 1 ? "default" : "secondary"}>
                              {task.priority === 2 ? 'High' : task.priority === 1 ? 'Medium' : 'Low'}
                            </Badge>
                          </div>
                        </Link>
                      ))}
                      {tasks.length === 0 && (
                        <p className="text-center text-muted-foreground py-4">No tasks yet</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Team Overview */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Your Teams
                    </CardTitle>
                    <CardDescription>Teams you're part of</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {teams.map((team: any) => (
                        <div key={team.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                              <span className="text-white text-xs font-medium">
                                {team.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium text-sm">{team.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {team.role === 'lead' ? 'Team Lead' : team.role === 'contributor' ? 'Contributor' : 'Member'}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                      {teams.length === 0 && (
                        <p className="text-center text-muted-foreground py-4">No teams yet</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Recent Documents */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Recent Documents
                    </div>
                    <Link href="/dashboard/documents">
                      <Button variant="ghost" size="sm" className="text-xs">
                        View All
                      </Button>
                    </Link>
                  </CardTitle>
                  <CardDescription>Latest document updates</CardDescription>
                </CardHeader>
                <CardContent>
                  {documents.length > 0 ? (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {documents.slice(0, 6).map((doc: any, index: number) => (
                        <Link key={doc.id} href={`/dashboard/documents/${doc.id}`} className="block">
                          <div className="border rounded-lg p-4 hover:bg-muted/50 cursor-pointer transition-colors">
                            <FileText className={`h-6 w-6 mb-2 ${index % 3 === 0 ? 'text-purple-600' :
                              index % 3 === 1 ? 'text-pink-600' : 'text-blue-600'
                              }`} />
                            <h3 className="font-medium text-sm">{doc.title}</h3>
                            <p className="text-xs text-muted-foreground mt-1">
                              Updated {new Date(doc.updatedAt).toLocaleDateString()}
                            </p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">
                      No documents yet. <Link href="/dashboard/documents" className="text-primary hover:underline">Create your first document</Link> in the Documents section.
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tasks Tab */}
            <TabsContent value="tasks" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">To Do</CardTitle>
                    <CardDescription>Tasks to get started</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {tasks.filter((task: any) => task.status === 0).map((task: any) => (
                        <Link key={task.id} href="/dashboard/tasks" className="block">
                          <div className="group p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm transition-all duration-200 cursor-pointer">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-start space-x-3 flex-1">
                                <div className="w-4 h-4 rounded-full border-2 border-gray-300 dark:border-gray-600 mt-0.5 group-hover:border-blue-500 transition-colors" />
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">{task.title}</h4>
                                  {task.description && (
                                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">{task.description}</p>
                                  )}
                                </div>
                              </div>
                              <Badge
                                variant={task.priority === 2 ? "destructive" : task.priority === 1 ? "default" : "secondary"}
                                className="text-xs ml-2 flex-shrink-0"
                              >
                                {task.priority === 2 ? 'High' : task.priority === 1 ? 'Medium' : 'Low'}
                              </Badge>
                            </div>
                            <div className="flex items-center justify-between">
                              {task.dueDate && (
                                <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                                  <Clock className="h-3 w-3 mr-1" />
                                  <span>Due {new Date(task.dueDate).toLocaleDateString()}</span>
                                </div>
                              )}
                              {task.assignee && (
                                <div className="flex items-center ml-auto">
                                  <img
                                    src={task.assignee.avatarUrl || "/placeholder-user.jpg"}
                                    alt={task.assignee.name}
                                    className="w-5 h-5 rounded-full border border-gray-200 dark:border-gray-600"
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        </Link>
                      ))}
                      {tasks.filter((task: any) => task.status === 0).length === 0 && (
                        <div className="text-center py-8">
                          <CheckSquare className="h-8 w-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                          <p className="text-sm text-gray-500 dark:text-gray-400">No pending tasks</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">Great job staying on top of things!</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">In Progress</CardTitle>
                    <CardDescription>Currently working on</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {tasks.filter((task: any) => task.status === 1).map((task: any) => (
                        <Link key={task.id} href="/dashboard/tasks" className="block">
                          <div className="group p-4 border border-yellow-200 dark:border-yellow-700/50 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-lg hover:shadow-md transition-all duration-200 cursor-pointer">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-start space-x-3 flex-1">
                                <div className="w-4 h-4 rounded-full border-2 border-yellow-400 bg-yellow-400 mt-0.5 relative">
                                  <div className="absolute inset-0.5 bg-white dark:bg-yellow-800 rounded-full animate-pulse" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">{task.title}</h4>
                                  {task.description && (
                                    <p className="text-xs text-gray-700 dark:text-gray-300 mt-1 line-clamp-2">{task.description}</p>
                                  )}
                                </div>
                              </div>
                              <Badge
                                variant={task.priority === 2 ? "destructive" : task.priority === 1 ? "default" : "secondary"}
                                className="text-xs ml-2 flex-shrink-0"
                              >
                                {task.priority === 2 ? 'High' : task.priority === 1 ? 'Medium' : 'Low'}
                              </Badge>
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <div className="flex items-center text-xs text-yellow-700 dark:text-yellow-300 bg-yellow-100 dark:bg-yellow-800/30 px-2 py-1 rounded-full">
                                  <Clock className="h-3 w-3 mr-1" />
                                  <span>In Progress</span>
                                </div>
                                {task.dueDate && (
                                  <div className="flex items-center text-xs text-gray-600 dark:text-gray-400">
                                    <span>Due {new Date(task.dueDate).toLocaleDateString()}</span>
                                  </div>
                                )}
                              </div>
                              {task.assignee && (
                                <div className="flex items-center">
                                  <img
                                    src={task.assignee.avatarUrl || "/placeholder-user.jpg"}
                                    alt={task.assignee.name}
                                    className="w-5 h-5 rounded-full border-2 border-yellow-300 dark:border-yellow-600"
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        </Link>
                      ))}
                      {tasks.filter((task: any) => task.status === 1).length === 0 && (
                        <div className="text-center py-8">
                          <Clock className="h-8 w-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                          <p className="text-sm text-gray-500 dark:text-gray-400">No active tasks</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">Ready to start something new?</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Completed</CardTitle>
                    <CardDescription>Recently finished</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {tasks.filter((task: any) => task.status === 2).slice(0, 5).map((task: any) => (
                        <Link key={task.id} href="/dashboard/tasks" className="block">
                          <div className="group p-4 border border-green-200 dark:border-green-700/50 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg hover:shadow-md transition-all duration-200 cursor-pointer">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-start space-x-3 flex-1">
                                <div className="w-4 h-4 rounded-full bg-green-500 mt-0.5 flex items-center justify-center">
                                  <CheckSquare className="h-2.5 w-2.5 text-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300 line-through opacity-75">{task.title}</h4>
                                  {task.description && (
                                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-through opacity-60 line-clamp-2">{task.description}</p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <div className="flex items-center text-xs text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-800/30 px-2 py-1 rounded-full">
                                  <CheckSquare className="h-3 w-3 mr-1" />
                                  <span>Done</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center justify-between">
                              {task.dueDate && (
                                <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                                  <span>Completed {new Date(task.updatedAt || task.createdAt).toLocaleDateString()}</span>
                                </div>
                              )}
                              {task.assignee && (
                                <div className="flex items-center ml-auto">
                                  <img
                                    src={task.assignee.avatarUrl || "/placeholder-user.jpg"}
                                    alt={task.assignee.name}
                                    className="w-5 h-5 rounded-full border-2 border-green-300 dark:border-green-600 opacity-75"
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        </Link>
                      ))}
                      {tasks.filter((task: any) => task.status === 2).length === 0 && (
                        <div className="text-center py-8">
                          <CheckSquare className="h-8 w-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                          <p className="text-sm text-gray-500 dark:text-gray-400">No completed tasks</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">Complete some tasks to see them here!</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Activity Tab */}
            <TabsContent value="activity">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                  <CardDescription>Latest updates from your teams and organization</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3 p-3 border rounded-lg">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <Users className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">You joined {teams.length} teams</p>
                        <p className="text-xs text-muted-foreground">Welcome to your teams!</p>
                      </div>
                    </div>

                    {tasks.length > 0 && (
                      <div className="flex items-center space-x-3 p-3 border rounded-lg">
                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                          <CheckSquare className="h-4 w-4 text-green-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{tasks.filter((t: any) => t.status === 2).length} tasks completed</p>
                          <p className="text-xs text-muted-foreground">Great progress on your tasks!</p>
                        </div>
                      </div>
                    )}

                    {documents.length > 0 && (
                      <div className="flex items-center space-x-3 p-3 border rounded-lg">
                        <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                          <FileText className="h-4 w-4 text-purple-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{documents.length} documents available</p>
                          <p className="text-xs text-muted-foreground">Knowledge base is growing!</p>
                        </div>
                      </div>
                    )}

                    {teams.length === 0 && tasks.length === 0 && documents.length === 0 && (
                      <div className="text-center py-8">
                        <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                          <MessageSquare className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <p className="text-muted-foreground">No recent activity yet</p>
                        <p className="text-sm text-muted-foreground">Start by joining teams or creating tasks!</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Add Team Member Dialog */}
          <AddTeamMemberDialog
            open={addMemberDialogOpen}
            onOpenChange={setAddMemberDialogOpen}
            teamId={selectedTeamForMember}
            teamName={teams.find(t => t.id === selectedTeamForMember)?.name || 'Team'}
            onMemberAdded={handleMemberAdded}
          />
        </div>
      )}
    </div>
  )
}

