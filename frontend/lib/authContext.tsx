"use client"

import React, { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react'
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
  
  // Teams of the selected organization
  teams: Team[]
  // Every team the user belongs to, across organizations
  allTeams: Team[]
  
  setUser: (user: User | null) => void
  setCurrentOrganization: (org: Organization | null) => void
  setOrganizations: (orgs: Organization[]) => void
  setTeams: (teams: Team[]) => void
  refreshUserData: () => Promise<void>
  refreshOrganizations: (selectId?: string) => Promise<void>
  refreshTeams: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: ReactNode
}

const ORGANIZATION_KEY = 'currentOrganizationId'

const readStoredOrganizationId = () => {
  try {
    return localStorage.getItem(ORGANIZATION_KEY)
  } catch {
    return null
  }
}

const storeOrganizationId = (id: string | null) => {
  try {
    if (id) localStorage.setItem(ORGANIZATION_KEY, id)
    else localStorage.removeItem(ORGANIZATION_KEY)
  } catch {
    // storage can be unavailable (private mode); the selection then lasts for the session only
  }
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [allTeams, setAllTeams] = useState<Team[]>([])
  const [orgsFetch, setOrgsFetch] = useState<'loading' | 'ok' | 'error'>('loading')
  const [teamsFetch, setTeamsFetch] = useState<'loading' | 'ok' | 'error'>('loading')

  const isAuthenticated = !!user

  // The app shows one organization at a time: its teams (teams without an organization are always shown).
  // While organizations are still loading nothing is selected yet, so show none rather than every organization's.
  const teams = useMemo(() => {
    if (currentOrganization) {
      return allTeams.filter(t => !t.organizationId || t.organizationId === currentOrganization.id)
    }
    return orgsFetch === 'loading' ? [] : allTeams
  }, [allTeams, currentOrganization, orgsFetch])

  const workspaceStatus: WorkspaceStatus =
    orgsFetch === 'error' || teamsFetch === 'error' ? 'error'
      : orgsFetch === 'loading' || teamsFetch === 'loading' ? 'loading'
      : organizations.length === 0 && allTeams.length === 0 ? 'empty'
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

  // Keeps the selected organization (re-read from the fresh list so renames show up), falls back to the one
  // remembered from last time, then to the first. `selectId` switches to a specific one (e.g. a new organization).
  const refreshOrganizations = async (selectId?: string) => {
    try {
      const orgsData: Organization[] = (await organizationsApi.getAllOrganizations()) || []
      setOrganizations(orgsData)

      setCurrentOrganization(previous => {
        const wanted = selectId ?? previous?.id ?? readStoredOrganizationId()
        const next = orgsData.find(o => o.id === wanted) ?? orgsData[0] ?? null
        storeOrganizationId(next?.id ?? null)
        return next
      })
      setOrgsFetch('ok')
    } catch (error) {
      setOrgsFetch('error')
    }
  }

  const refreshTeams = async () => {
    try {
      const teamsData = await teamApi.getTeams()
      setAllTeams(teamsData || [])
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
            setAllTeams([])
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
    storeOrganizationId(org?.id ?? null)
    setCurrentOrganization(org)
  }

  const updateOrganizations = (orgs: Organization[]) => {
    setOrganizations(orgs)
  }

  const updateTeams = (teamsData: Team[]) => {
    setAllTeams(teamsData)
  }

  const clearStoredData = () => {
    localStorage.removeItem('user')
    
    localStorage.removeItem('currentOrganization')
    localStorage.removeItem(ORGANIZATION_KEY)
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
    setAllTeams([])
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
    allTeams,
    
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