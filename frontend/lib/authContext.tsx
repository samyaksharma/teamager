"use client"

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { usersApi, organizationsApi, teamApi } from './api'
import { authApi } from './authApi'

interface User {
  id: string
  name: string
  username: string
  email: string
  emailVerified: boolean
  avatarUrl?: string
  role?: string
  department?: string
  createdAt: string
}

interface Organization {
  id: string
  name: string
  size?: string
  industry?: string
  createdAt: string
  updatedAt: string
}

interface Team {
  id: string
  name: string
  organizationId?: string
  createdAt: string
  deletedAt?: string
  deletedBy?: string
}

interface AuthContextType {
  // Auth state
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  
  // Organization state
  currentOrganization: Organization | null
  organizations: Organization[]
  
  // Teams state
  teams: Team[]
  
  // Actions
  setUser: (user: User | null) => void
  setCurrentOrganization: (org: Organization | null) => void
  setOrganizations: (orgs: Organization[]) => void
  setTeams: (teams: Team[]) => void
  refreshUserData: () => Promise<void>
  refreshOrganizations: () => Promise<void>
  refreshTeams: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [teams, setTeams] = useState<Team[]>([])

  const isAuthenticated = !!user

  const refreshUserData = async () => {
    try {
      const userData = await usersApi.getCurrentUser()
      if (userData?.id) {
        setUser(userData)
        // User data is now managed entirely through HTTP-only cookies on the server
      }
    } catch (error) {
    }
  }

  const refreshOrganizations = async () => {
    try {
      const orgsData = await organizationsApi.getAllOrganizations()
      setOrganizations(orgsData || [])
      
      // Set current organization if not set and we have organizations
      if (!currentOrganization && orgsData && orgsData.length > 0) {
        setCurrentOrganization(orgsData[0])
      }
    } catch (error) {
    }
  }

  const refreshTeams = async () => {
    try {
      const teamsData = await teamApi.getTeams()
      setTeams(teamsData || [])
    } catch (error) {
    }
  }

  // Initialize auth state and fetch data
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        
        // Set a shorter timeout for faster feedback
        const authTimeout = setTimeout(() => {
          if (!user) {
            setIsLoading(false) // Allow UI to render with proper loading states
          }
        }, 1000) // 1 second timeout instead of waiting indefinitely
        
        // Verify authentication with server immediately (access token in HTTP-only cookie)
        // We'll rely on the server's HTTP-only cookies for security instead of localStorage
        try {
          const userData = await usersApi.getCurrentUser()
          clearTimeout(authTimeout)
          
          if (userData?.id) {
            setUser(userData)
            setIsLoading(false)
            
            // Load org/team data only after successful authentication
            Promise.all([
              refreshOrganizations(),
              refreshTeams()
            ]).catch(console.error)
          }
        } catch (error) {
          clearTimeout(authTimeout)
          
          // If 401, user is not authenticated - clear everything
          if (error.response?.status === 401) {
            clearStoredData()
            setUser(null)
            setOrganizations([])
            setTeams([])
          }
          setIsLoading(false)
        }
      } catch (error) {
        // Clear invalid stored data
        clearStoredData()
        setIsLoading(false)
      }
    }

    initializeAuth()
  }, [])

  const updateCurrentOrganization = (org: Organization | null) => {
    setCurrentOrganization(org)
  }

  const updateOrganizations = (orgs: Organization[]) => {
    setOrganizations(orgs)
  }

  const updateTeams = (teamsData: Team[]) => {
    setTeams(teamsData)
  }

  const clearStoredData = () => {
    // Clear user data (access token is now in HTTP-only cookies, handled by server)
    localStorage.removeItem('user')
    
    // Clear organization and team data
    localStorage.removeItem('currentOrganization')
    localStorage.removeItem('organizations')
    localStorage.removeItem('teams')
    
    // Clear any other app-specific data
    localStorage.removeItem('pendingOrgSetup')
    localStorage.removeItem('loginError')
    
    // Clear any React DevTools or debugging data that might persist state
    // Some browser extensions or development tools automatically store React state
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('react-') || 
          key.includes('organization') || 
          key.includes('team') || 
          key.includes('user') ||
          key.includes('auth')) {
        // Skip theme-related keys as these are user preferences
        if (!key.includes('theme')) {
          localStorage.removeItem(key)
        }
      }
    })
    
    // Note: We preserve theme settings (theme, theme-variant) as these are user preferences
    // that should persist across login sessions
    // Note: Access tokens are now in HTTP-only cookies and handled by the server
  }

  const logout = async () => {
    try {
      // Call backend logout to clear refresh token cookie
      await authApi.logout()
    } catch (error) {
      // Continue with frontend cleanup even if backend call fails
    }
    
    // Clear frontend state and localStorage
    setUser(null)
    setCurrentOrganization(null)
    setOrganizations([])
    setTeams([])
    clearStoredData()
  }

  const value: AuthContextType = {
    // Auth state
    user,
    isLoading,
    isAuthenticated,
    
    // Organization state
    currentOrganization,
    organizations,
    
    // Teams state
    teams,
    
    // Actions
    setUser,
    setCurrentOrganization: updateCurrentOrganization,
    setOrganizations: updateOrganizations,
    setTeams: updateTeams,
    refreshUserData,
    refreshOrganizations,
    refreshTeams,
    logout
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export default AuthContext