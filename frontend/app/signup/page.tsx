"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { ThemeToggle } from "@/components/theme-toggle"
import { TeamagerLogo } from "@/components/teamager-logo"
import { Loader2 } from "lucide-react"
import { OrganizationForm } from "@/components/signup/organization-form"
import { UserForm } from "@/components/signup/user-form"
import { PreferencesForm } from "@/components/signup/preferences-form"
import { SuccessStep } from "@/components/signup/success-step"
import { useAuth } from "@/lib/authContext"

// Define the stages of the signup process
type SignupStage = "organization" | "user" | "preferences" | "success"

// Define the data structure for the signup process
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

export default function SignupPage() {
  const router = useRouter()
  const { user, isLoading: authLoading } = useAuth()

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (!authLoading && user) {
      router.push('/dashboard')
    }
  }, [user, authLoading, router])

  // Track the current stage of the signup process
  const [currentStage, setCurrentStage] = useState<SignupStage>("organization")

  // Initialize the signup data
  const [signupData, setSignupData] = useState<SignupData>({
    organization: {
      name: "",
      size: "",
      industry: "",
    },
    user: {
      name: "",
      username: "",
      email: "",
      password: "",
    },
    preferences: {
      organizationRole: "",
      department: "",
      jobTitle: "",
      notifications: true,
      termsAccepted: false,
    },
  })

  // Calculate progress percentage based on current stage
  const getProgressPercentage = () => {
    switch (currentStage) {
      case "organization":
        return 25
      case "user":
        return 50
      case "preferences":
        return 75
      case "success":
        return 100
      default:
        return 0
    }
  }

  // Handle organization form submission
  const handleOrganizationSubmit = (orgData: SignupData["organization"]) => {
    setSignupData({ ...signupData, organization: orgData })
    setCurrentStage("user")
  }

  // Handle user form submission
  const handleUserSubmit = (userData: SignupData["user"]) => {
    setSignupData({ ...signupData, user: userData })
    setCurrentStage("preferences")
  }

  // Handle preferences form submission
  const handlePreferencesSubmit = (preferencesData: SignupData["preferences"]) => {
    setSignupData({ ...signupData, preferences: preferencesData })
    setCurrentStage("success")
  }

  // Handle going back to the previous stage
  const handleBack = () => {
    if (currentStage === "preferences") {
      setCurrentStage("user")
    } else if (currentStage === "user") {
      setCurrentStage("organization")
    }
  }

  // Handle restarting from error (keeps user data)
  const handleRestart = () => {
    setCurrentStage("organization")
    // Keep the existing signup data instead of clearing it
  }

  // Render the current stage of the signup process
  const renderCurrentStage = () => {
    switch (currentStage) {
      case "organization":
        return <OrganizationForm initialData={signupData.organization} onSubmit={handleOrganizationSubmit} />
      case "user":
        return <UserForm initialData={signupData.user} onSubmit={handleUserSubmit} onBack={handleBack} />
      case "preferences":
        return (
          <PreferencesForm
            initialData={signupData.preferences}
            onSubmit={handlePreferencesSubmit}
            onBack={handleBack}
          />
        )
      case "success":
        return <SuccessStep data={signupData} onRestart={handleRestart} />
      default:
        return null
    }
  }

  // Show loading while checking authentication
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  // Don't render signup form if user is already authenticated
  if (user) {
    return null // Will redirect via useEffect
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header with theme toggle */}
      <header className="flex items-center justify-between px-6 py-4 md:p-6">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl">
          <TeamagerLogo className="h-6 w-6" />
        </Link>
        <ThemeToggle />
      </header>

      <main className="flex-1 flex items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-2xl">
          <Card>
            <CardContent className="pt-6">
              <div className="mb-8">
                <div className="flex justify-between mb-2 text-sm">
                  <span>Sign Up</span>
                  <span>
                    Step{" "}
                    {currentStage === "success"
                      ? 3
                      : currentStage === "preferences"
                        ? 2
                        : 1}{" "}
                    of 3
                  </span>
                </div>
                <Progress value={getProgressPercentage()} className="h-2" />
              </div>

              {renderCurrentStage()}
            </CardContent>
          </Card>

          {currentStage !== "success" && (
            <div className="mt-4 text-center text-sm">
              Already have an account?{" "}
              <Link href="/login" className="text-primary hover:underline">
                Sign in
              </Link>
            </div>
          )}
        </div>
      </main>

      <footer className="py-6 text-center text-sm text-muted-foreground">
        <p>&copy; 2025 Teamager. All rights reserved.</p>
      </footer>
    </div>
  )
}
