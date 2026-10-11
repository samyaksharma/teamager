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

type SignupStage = "organization" | "user" | "preferences" | "success"

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

  const [currentStage, setCurrentStage] = useState<SignupStage>("organization")

  // Redirect already-signed-in visitors to the dashboard. Not during the final step: it signs the new
  // account in itself and finishes creating the workspace before offering the dashboard.
  useEffect(() => {
    if (!authLoading && user && currentStage !== "success") {
      router.push('/dashboard')
    }
  }, [user, authLoading, router, currentStage])

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

  const handleOrganizationSubmit = (orgData: SignupData["organization"]) => {
    setSignupData({ ...signupData, organization: orgData })
    setCurrentStage("user")
  }

  const handleUserSubmit = (userData: SignupData["user"]) => {
    setSignupData({ ...signupData, user: userData })
    setCurrentStage("preferences")
  }

  const handlePreferencesSubmit = (preferencesData: SignupData["preferences"]) => {
    setSignupData({ ...signupData, preferences: preferencesData })
    setCurrentStage("success")
  }

  const handleBack = () => {
    if (currentStage === "preferences") {
      setCurrentStage("user")
    } else if (currentStage === "user") {
      setCurrentStage("organization")
    }
  }

  const handleRestart = () => {
    setCurrentStage("organization")
  }

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

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  // Don't render the form for visitors who are already signed in (they're redirected), except on the final
  // step, which signs the new account in itself and keeps showing progress
  if (user && currentStage !== "success") {
    return null
  }

  return (
    <div className="min-h-screen flex flex-col">
      
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
