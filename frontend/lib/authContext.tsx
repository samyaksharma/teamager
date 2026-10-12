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
  // The current user's role in this organization (OrganizationRole)
  role?: number
}

interface Team {
  id: string
  name: string
  organizationId?: string
  // The current user's role in this team (TeamRole)
  role?: number
  createdAt: string
  deletedAt?: string
  deletedBy?: string
}

// loading: organizations/teams not fetched yet; empty: fetched and the user belongs to none;
// ready: has a workspace; error: a request failed (don't claim the user has no workspace)
export type WorkspaceStatus = 'loading' | 'empty' | 'ready' | 'error'

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  workspaceStatus: WorkspaceStatus
  
  currentOrganization: Organization | null
  organizations: Organization[]
  
  teams: Team[]
  
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
  const [orgsFetch, setOrgsFetch] = useState<'loading' | 'ok' | 'error'>('loading')
  const [teamsFetch, setTeamsFetch] = useState<'loading' | 'ok' | 'error'>('loading')

  const isAuthenticated = !!user

  const workspaceStatus: WorkspaceStatus =
    orgsFetch === 'error' || teamsFetch === 'error' ? 'error'
      : orgsFetch === 'loading' || teamsFetch === 'loading' ? 'loading'
      : organizations.length === 0 && teams.length === 0 ? 'empty'
      : 'ready'

  const refreshUserData = async () => {
    try {
      const userData = await usersApi.getCurrentUser()
      if (userData?.id) {
        setUser(userData)
      }
    } catch (error) {
    }
  }

  const refreshOrganizations = async () => {
    try {
      const orgsData = await organizationsApi.getAllOrganizations()
      setOrganizations(orgsData || [])
      
      if (!currentOrganization && orgsData && orgsData.length > 0) {
        setCurrentOrganization(orgsData[0])
      }
      setOrgsFetch('ok')
    } catch (error) {
      setOrgsFetch('error')
    }
  }

  const refreshTeams = async () => {
    try {
      const teamsData = await teamApi.getTeams()
      setTeams(teamsData || [])
      setTeamsFetch('ok')
    } catch (error) {
      setTeamsFetch('error')
    }
  }

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        
        const authTimeout = setTimeout(() => {
          if (!user) {
            setIsLoading(false)
          }
        }, 1000)
        
        // Verify authentication with server immediately (access token in HTTP-only cookie)
        // We'll rely on the server's HTTP-only cookies for security instead of localStorage
        try {
          const userData = await usersApi.getCurrentUser()
          clearTimeout(authTimeout)
          
          if (userData?.id) {
            setUser(userData)
            setIsLoading(false)
            
            Promise.all([
              refreshOrganizations(),
              refreshTeams()
            ]).catch(console.error)
          }
        } catch (error) {
          clearTimeout(authTimeout)
          
          if (error.response?.status === 401) {
            clearStoredData()
            setUser(null)
            setOrganizations([])
            setTeams([])
          }
          setIsLoading(false)
        }
      } catch (error) {
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
    localStorage.removeItem('user')
    
    localStorage.removeItem('currentOrganization')
    localStorage.removeItem('organizations')
    localStorage.removeItem('teams')
    
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
      await authApi.logout()
    } catch (error) {
      // Continue with frontend cleanup even if backend call fails
    }
    
    setUser(null)
    setCurrentOrganization(null)
    setOrganizations([])
    setTeams([])
    setOrgsFetch('loading')
    setTeamsFetch('loading')
    clearStoredData()
  }

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated,
    workspaceStatus,
    
    currentOrganization,
    organizations,
    
    teams,
    
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