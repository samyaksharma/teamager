"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { CheckCircle2, Loader2 } from "lucide-react"
import { authApi } from "@/lib/authApi"
import { organizationsApi } from "@/lib/api"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/authContext"

interface SignupData {
  organization: {
    name: string
    size: string
    industry: string
  }
  user: {
    name: string
    username: string
    email: string
    password: string
  }
  preferences: {
    organizationRole: string
    department: string
    jobTitle: string
    notifications: boolean
    termsAccepted: boolean
  }
}

interface SuccessStepProps {
  data: SignupData
  onRestart?: () => void
}

export function SuccessStep({ data, onRestart }: SuccessStepProps) {
  const [isRegistering, setIsRegistering] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Account was created but we couldn't sign the person in automatically
  const [needsLogin, setNeedsLogin] = useState(false)
  const router = useRouter()
  const { setUser, refreshOrganizations, refreshTeams } = useAuth()
  // Registration must happen exactly once, even if this effect runs twice (React StrictMode in development)
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    const signUp = async () => {
      try {
        setIsRegistering(true)
        setError(null)

        const registration = {
          name: data.user.name?.trim(),
          username: data.user.username?.trim().toLowerCase(),
          email: data.user.email?.trim().toLowerCase(),
          password: data.user.password
        }
        if (!registration.name || !registration.username || !registration.email || !registration.password) {
          throw new Error('Missing required fields for registration')
        }
        await authApi.register(registration)
      } catch (err: any) {
        let message = 'Registration failed. Please try again.'
        if (err.response?.data?.message) {
          message = err.response.data.message
          if (message.includes('User already exists with this email')) {
            message = `An account with the email "${data.user.email}" already exists. Please try logging in instead or use a different email address.`
          } else if (message.includes('Username is already taken')) {
            message = `The username "${data.user.username}" is already taken. Please go back and choose a different username.`
          } else if (message.includes('All fields are required')) {
            message = 'Please fill in all required fields (name, username, email, and password).'
          }
        } else if (err.message) {
          message = err.message
        }
        setError(message)
        setIsRegistering(false)
        return
      }

      try {
        const login = await authApi.login(data.user.email.trim().toLowerCase(), data.user.password)
        if (login.user) {
          setUser(login.user)
          localStorage.setItem('user', JSON.stringify(login.user))
        }
      } catch {
        // The account exists; they can sign in manually
        setNeedsLogin(true)
        setIsRegistering(false)
        return
      }

      // Step 3: create the workspace they described (kept in localStorage until it succeeds, so the
      // login page can still finish it if this step is interrupted)
      if (data.organization.name) {
        const orgSetup = {
          name: data.organization.name,
          size: data.organization.size,
          industry: data.organization.industry,
          role: data.preferences.organizationRole,
          department: data.preferences.department,
          jobTitle: data.preferences.jobTitle,
          timestamp: Date.now()
        }
        localStorage.setItem('pendingOrgSetup', JSON.stringify(orgSetup))
        try {
          const existing = await organizationsApi.getAllOrganizations()
          if (!existing || existing.length === 0) {
            await organizationsApi.createOrganization(orgSetup)
          }
          localStorage.removeItem('pendingOrgSetup')
        } catch {
          // Leave pendingOrgSetup in place; the login page retries it
        }
      }

      try {
        await Promise.all([refreshOrganizations(), refreshTeams()])
      } catch {
        // The dashboard loads this data again
      }

      setIsRegistering(false)
    }

    signUp()
    // Run once on mount: `data` is complete by the time this step is shown
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="space-y-6 py-8">
      <div className="flex flex-col items-center justify-center text-center space-y-4">
        {isRegistering ? (
          <>
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <h1 className="text-2xl font-bold">Setting Up Your Account...</h1>
            <p className="text-muted-foreground max-w-md">
              We're creating your account and setting up your workspace. This will just take a moment.
            </p>
          </>
        ) : error ? (
          <>
            <div className="rounded-full bg-destructive/10 p-3">
              <CheckCircle2 className="h-12 w-12 text-destructive" />
            </div>
            <h1 className="text-2xl font-bold">Registration Issue</h1>
            <p className="text-muted-foreground max-w-md">{error}</p>
            <div className="flex flex-col sm:flex-row gap-2">
              {error.includes('already exists') ? (
                <>
                  <Link href="/login">
                    <Button className="w-full sm:w-auto">Go to Login</Button>
                  </Link>
                  <Button onClick={() => onRestart?.()} variant="outline" className="w-full sm:w-auto">
                    Use Different Email
                  </Button>
                </>
              ) : (
                <Button onClick={() => onRestart?.()} variant="outline">Try Again</Button>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="rounded-full bg-primary/10 p-3">
              <CheckCircle2 className="h-12 w-12 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">Setup Complete!</h1>
            <p className="text-muted-foreground max-w-md">
              {needsLogin
                ? "Your account has been created. Please sign in to continue."
                : "Your account is ready and you're signed in. You can head to your dashboard to start collaborating."}
            </p>
          </>
        )}
      </div>

      {!isRegistering && !error && (
        <>
          <div className="space-y-4">
            <div className="rounded-lg border p-4">
              <h3 className="font-medium mb-2">Account Information</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-muted-foreground">Name:</div>
                <div>{data.user.name}</div>
                <div className="text-muted-foreground">Email:</div>
                <div>{data.user.email}</div>
                <div className="text-muted-foreground">Organization Role:</div>
                <div>{data.preferences.organizationRole}</div>
                <div className="text-muted-foreground">Job Title:</div>
                <div>{data.preferences.jobTitle}</div>
                <div className="text-muted-foreground">Department:</div>
                <div>{data.preferences.department}</div>

                {data.organization.name && (
                  <>
                    <div className="text-muted-foreground">Organization:</div>
                    <div>{data.organization.name}</div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            {needsLogin ? (
              <Link href="/login">
                <Button size="lg">Go to Login</Button>
              </Link>
            ) : (
              <Button size="lg" onClick={() => router.push("/dashboard")}>Go to Dashboard</Button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
