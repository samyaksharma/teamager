'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isAuthenticated, checkAuthAndRedirect } from '@/lib/auth'
import { useAuth as useAuthContext } from '@/lib/authContext'

interface AuthGuardProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function AuthGuard({ children, fallback }: AuthGuardProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthed, setIsAuthed] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const verifyAuth = async () => {
      try {
        // With HTTP-only cookies, we need to check with the server directly
        const isValid = await checkAuthAndRedirect()
        setIsAuthed(isValid)
      } catch (error) {
        router.push('/login')
      } finally {
        setIsLoading(false)
      }
    }

    verifyAuth()
  }, [router])

  if (isLoading) {
    return (
      fallback || (
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )
    )
  }

  if (!isAuthed) {
    return null // Router push will handle redirect
  }

  return <>{children}</>
}

// Hook for checking auth state in components - now uses context
export function useAuth() {
  const { user, isLoading, isAuthenticated } = useAuthContext()
  return { 
    isLoading, 
    isAuthenticated, 
    user: user ? { user } : null // Maintain backward compatibility
  }
}