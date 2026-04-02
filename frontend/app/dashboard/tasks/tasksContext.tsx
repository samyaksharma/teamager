'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { tasksApi } from '@/lib/api'

interface Task {
  id: string
  title: string
  description: string
  status: string | number  // Allow both string and number
  priority: string | number  // Allow both string and number
  assignedTo?: string
  dueDate?: Date
  createdAt: Date
  updatedAt?: Date
  teamId?: string // Legacy field
  organizationId?: string
  teams?: Array<{
    id: string
    name: string
  }>
  organization?: {
    id: string
    name: string
  }
  assignee?: {
    id: string
    name: string
    username: string
    avatarUrl?: string
  }
  creator?: {
    id: string
    name: string
    username: string
    avatarUrl?: string
  }
}

interface TasksContextType {
  tasks: Task[]
  isLoading: boolean
  error: Error | null
  createTask: (taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Task>
  updateTask: (taskId: string, changes: Partial<Task>) => Promise<Task>
  deleteTask: (taskId: string) => Promise<void>
  refreshTasks: () => Promise<void>
  getTasksByStatus: (status: string) => Task[]
  getTasksByTeam: (teamId: string) => Task[]
  getTasksByOrganization: (orgId: string) => Task[]
}

const TasksContext = createContext<TasksContextType>({
  tasks: [],
  isLoading: false,
  error: null,
  createTask: async () => ({} as Task),
  updateTask: async () => ({} as Task),
  deleteTask: async () => {},
  refreshTasks: async () => {},
  getTasksByStatus: () => [],
  getTasksByTeam: () => [],
  getTasksByOrganization: () => []
})

export const useTasks = () => useContext(TasksContext)

export const TasksProvider = ({ children }: { children: React.ReactNode }) => {
  const [tasks, setTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [lastFetchTime, setLastFetchTime] = useState<number>(0)

  // Initial fetch and polling setup
  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const fetchedTasks = await tasksApi.getAllTasks()
        setTasks(fetchedTasks)
        
        // Update last fetch time
        setLastFetchTime(Date.now())
        setIsLoading(false)
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch tasks'))
        setIsLoading(false)
      }
    }

    // Function to poll for new or updated tasks
    const pollForTaskUpdates = async () => {
      try {
        const updatedTasks = await tasksApi.getAllTasks()
        
        // Check for any new or updated tasks
        const hasChanges = updatedTasks.some(newTask => {
          const existingTask = tasks.find(task => task.id === newTask.id)
          if (!existingTask) return true // New task
          
          // Check if task was updated after our last fetch
          const taskUpdateTime = new Date(newTask.updatedAt).getTime()
          return taskUpdateTime > lastFetchTime
        })
        
        if (hasChanges) {
          setTasks(updatedTasks)
        }
        
        setLastFetchTime(Date.now())
      } catch (err) {
      }
    }
    
    // Initial fetch
    fetchTasks()
    
    // Set up polling interval (every 5 seconds)
    const intervalId = setInterval(pollForTaskUpdates, 5000)
    
    // Clean up on unmount
    return () => {
      clearInterval(intervalId)
    }
  }, [tasks, lastFetchTime])

  // Create a new task
  const createTask = async (taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const newTask = await tasksApi.createTask(taskData)
      setTasks(prev => [...prev, newTask])
      return newTask
    } catch (err) {
      throw err
    }
  }

  // Update an existing task
  const updateTask = async (taskId: string, changes: Partial<Task>) => {
    try {
      const updatedTask = await tasksApi.updateTask(taskId, changes)
      
      setTasks(prev => 
        prev.map(task => 
          task.id === taskId ? { ...task, ...updatedTask } : task
        )
      )
      
      return updatedTask
    } catch (err) {
      throw err
    }
  }

  // Delete a task
  const deleteTask = async (taskId: string) => {
    try {
      await tasksApi.deleteTask(taskId)
      setTasks(prev => prev.filter(task => task.id !== taskId))
    } catch (err) {
      throw err
    }
  }

  // Manually refresh tasks
  const refreshTasks = async () => {
    try {
      setIsLoading(true)
      const fetchedTasks = await tasksApi.getAllTasks()
      setTasks(fetchedTasks)
      setLastFetchTime(Date.now())
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to refresh tasks'))
    } finally {
      setIsLoading(false)
    }
  }

  // Filter tasks by status
  const getTasksByStatus = (status: string) => {
    // Handle both string and integer status values
    if (status === 'backlog' || status === 'todo') {
      return tasks.filter(task => task.status === 0 || task.status === 'backlog' || task.status === 'todo')
    } else if (status === 'in-progress') {
      return tasks.filter(task => task.status === 1 || task.status === 'in-progress')
    } else if (status === 'done') {
      return tasks.filter(task => task.status === 2 || task.status === 'done')
    }
    return tasks.filter(task => task.status === status)
  }

  // Filter tasks by team
  const getTasksByTeam = (teamId: string) => {
    return tasks.filter(task => 
      task.teamId === teamId || 
      task.teams?.some(team => team.id === teamId)
    )
  }

  // Filter tasks by organization
  const getTasksByOrganization = (orgId: string) => {
    return tasks.filter(task => task.organizationId === orgId)
  }

  return (
    <TasksContext.Provider
      value={{
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
      }}
    >
      {children}
    </TasksContext.Provider>
  )
}