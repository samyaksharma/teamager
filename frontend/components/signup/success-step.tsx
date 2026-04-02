"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { CheckCircle2, Loader2 } from "lucide-react"
import { authApi } from "@/lib/authApi"
import { organizationsApi } from "@/lib/api"
import { useRouter } from "next/navigation"

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
  const [isVerificationEmailSent, setIsVerificationEmailSent] = useState(false)
  const router = useRouter()

  useEffect(() => {
    let mounted = true // Prevent multiple executions
    let hasRun = false // Prevent double execution in React strict mode
    
    const registerUser = async () => {
      if (!mounted || hasRun) return
      hasRun = true
      
      try {
        setIsRegistering(true)
        setError(null)

        // Step 1: Create user account with chosen username
        const userRegistrationData = {
          name: data.user.name?.trim(),
          username: data.user.username?.trim().toLowerCase(),
          email: data.user.email?.trim().toLowerCase(),
          password: data.user.password
        }

        
        // Validate that all required fields are present
        if (!userRegistrationData.name || !userRegistrationData.username || 
            !userRegistrationData.email || !userRegistrationData.password) {
          throw new Error('Missing required fields for registration')
        }
        
        // Check if user might already exist by trying to detect the 400 error first
        const response = await authApi.register(userRegistrationData)
        
        // Step 2: If organization data provided, create organization after user verification
        // For now, we'll store org data in localStorage for post-verification setup
        if (data.organization.name) {
          const orgSetupData = {
            name: data.organization.name,
            size: data.organization.size,
            industry: data.organization.industry,
            role: data.preferences.organizationRole,
            department: data.preferences.department,
            jobTitle: data.preferences.jobTitle,
            timestamp: Date.now() // Add timestamp to prevent stale data
          }
          localStorage.setItem('pendingOrgSetup', JSON.stringify(orgSetupData))
        }
        setIsVerificationEmailSent(true)
        
      } catch (err: any) {
        
        // Extract specific error message from response
        let errorMessage = 'Registration failed. Please try again.'
        if (err.response?.data?.message) {
          errorMessage = err.response.data.message
          
          // Make error messages more user-friendly and specific
          if (errorMessage.includes('User already exists with this email')) {
            errorMessage = `An account with the email "${data.user.email}" already exists. Please try logging in instead or use a different email address.`
          } else if (errorMessage.includes('Username is already taken')) {
            errorMessage = `The username "${data.user.username}" is already taken. Please go back and choose a different username.`
          } else if (errorMessage.includes('All fields are required')) {
            errorMessage = 'Please fill in all required fields (name, username, email, and password).'
          }
        } else if (err.message) {
          errorMessage = err.message
        }
        
        setError(errorMessage)
      } finally {
        if (mounted) {
          setIsRegistering(false)
        }
      }
    }

    registerUser()
    
    return () => {
      mounted = false
    }
  }, [data])

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
            <p className="text-muted-foreground max-w-md">
              {error}
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              {error.includes('already exists') ? (
                <>
                  <Link href="/login">
                    <Button className="w-full sm:w-auto">
                      Go to Login
                    </Button>
                  </Link>
                  <Button 
                    onClick={() => onRestart?.()}
                    variant="outline"
                    className="w-full sm:w-auto"
                  >
                    Use Different Email
                  </Button>
                </>
              ) : (
                <Button 
                  onClick={() => onRestart?.()}
                  variant="outline"
                >
                  Try Again
                </Button>
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
              {isVerificationEmailSent 
                ? "Your account has been created successfully! Please check your email to verify your account before logging in."
                : "Your account has been created successfully. You can now access your dashboard to start collaborating or create your team."
              }
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
            {isVerificationEmailSent ? (
              <Link href="/login">
                <Button size="lg">Go to Login</Button>
              </Link>
            ) : (
              <Link href="/dashboard">
                <Button size="lg">Go to Dashboard</Button>
              </Link>
            )}
          </div>
        </>
      )}
    </div>
  )
}
