"use client"

import type React from "react"

import { useState, useEffect, Suspense } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { authApi } from "@/lib/authApi"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { ThemeToggle } from "@/components/theme-toggle"
import { TeamagerLogo } from "@/components/teamager-logo"
import { Github, Mail, Loader2 } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useAuth } from "@/lib/authContext"
import { organizationsApi } from "@/lib/api"

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    }>
      <LoginPageInner />
    </Suspense>
  )
}

function LoginPageInner() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showError, setShowError] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, isLoading: authLoading, setUser, refreshOrganizations, refreshTeams } = useAuth()

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (!authLoading && user) {
      router.push('/dashboard')
    }
  }, [user, authLoading, router])

  // Use a persistent error system that doesn't clear automatically
  useEffect(() => {
    // Check if we have an error stored in localStorage
    const storedError = localStorage.getItem('loginError')
    if (storedError) {
      setError(storedError)
      setShowError(true)
      // Clear the stored error after retrieving it
      localStorage.removeItem('loginError')
    }
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    // Prevent default form submission behavior
    e.preventDefault()

    // Reset error state and set loading
    setError(null)
    setShowError(false)
    setIsLoading(true)

    // Use a standard promise pattern instead of async/await
    authApi.login(email, password)
      .then(async response => {

        // Update auth context with user data (access token now in HTTP-only cookie)
        if (response.user) {
          setUser(response.user)
          localStorage.setItem('user', JSON.stringify(response.user))
        }

        // Check for pending organization setup from signup
        const pendingOrgSetup = localStorage.getItem('pendingOrgSetup')
        let orgCreated = false

        if (pendingOrgSetup) {
          try {
            const orgData = JSON.parse(pendingOrgSetup)

            // First check if user already has organizations to prevent duplicates
            const existingOrgs = await organizationsApi.getAllOrganizations()
            if (existingOrgs && existingOrgs.length > 0) {
              localStorage.removeItem('pendingOrgSetup')
            } else {
              const createdOrg = await organizationsApi.createOrganization(orgData)
              localStorage.removeItem('pendingOrgSetup')
              orgCreated = true
            }
          } catch (error) {
            // Continue anyway - user can create org later
          }
        }

        // Load organization and team data (especially important if org was just created)
        try {
          // Add a small delay if organization was just created to ensure DB consistency
          if (orgCreated) {
            await new Promise(resolve => setTimeout(resolve, 1000))
          }

          await Promise.all([
            refreshOrganizations(),
            refreshTeams()
          ])
        } catch (error) {
          // Continue anyway - context will handle missing data
        }

        // Use router.push for better state management
        const redirectUrl = searchParams?.get('redirect') || '/dashboard'
        router.push(redirectUrl)
      })
      .catch(err => {

        // Handle different types of errors
        let errorMessage = "";

        if (err.response) {
          // Server returned an error response (4xx, 5xx)
          const responseData = err.response.data
          errorMessage = responseData.message || "Login failed. Please check your credentials.";
        } else if (err.request) {
          // Request was made but no response received
          errorMessage = "No response from server. Please check your connection.";
        } else {
          // Something else went wrong
          errorMessage = "An unexpected error occurred. Please try again.";
        }

        // Set error in state
        setError(errorMessage)
        setShowError(true)

        // Also store in localStorage for persistence
        localStorage.setItem('loginError', errorMessage)
      })
      .finally(() => {
        // Always ensure loading state is reset on completion
        setIsLoading(false)
      })

    // Explicitly return false to prevent form submission
    return false
  }

  // Show loading while checking authentication
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  // Don't render login form if user is already authenticated
  if (user) {
    return null // Will redirect via useEffect
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header with theme toggle */}
      <header className="flex items-center justify-between px-6 py-4 md:p-6">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl">
          <TeamagerLogo className="h-6 w-6" />
          Teamager
        </Link>
        <ThemeToggle />
      </header>

      <main className="flex-1 flex items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
            <p className="text-sm text-muted-foreground mt-2">Enter your credentials to access your workspace</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    // Only clear error when user starts typing again
                    if (showError) {
                      setShowError(false)
                    }
                  }}
                  required
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link href="/forgot-password" className="text-xs text-primary hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    // Only clear error when user starts typing again
                    if (showError) {
                      setShowError(false)
                    }
                  }}
                  required
                />
              </div>


              {showError && error && (
                <div className="p-4 mt-2 rounded-md bg-destructive/15 border border-destructive text-destructive text-sm font-medium">
                  {error}
                </div>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
              onClick={(e) => {
                if (isLoading) {
                  e.preventDefault();
                  return false;
                }
              }}
            >
              {isLoading ? "Signing In..." : "Sign In"}
            </Button>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Separator className="flex-1" />
              <span>OR CONTINUE WITH</span>
              <Separator className="flex-1" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button variant="outline" type="button" className="gap-2">
                <Github className="h-4 w-4" />
                GitHub
              </Button>
              <Button variant="outline" type="button" className="gap-2">
                <Mail className="h-4 w-4" />
                Google
              </Button>
            </div>

            <div className="text-center text-sm">
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="text-primary hover:underline">
                Sign up
              </Link>
            </div>
          </form>
        </div>
      </main>

      <footer className="py-6 text-center text-sm text-muted-foreground">
        <p>&copy; 2025 Teamager. All rights reserved.</p>
      </footer>
    </div>
  )
}
