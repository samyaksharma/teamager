"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ThemeToggle } from "@/components/theme-toggle"
import { TeamagerLogo } from "@/components/teamager-logo"
import { AlertCircle, ArrowLeft, CheckCircle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Basic validation
    if (!email.trim()) {
      setError("Please enter your email address")
      return
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      setError("Please enter a valid email address")
      return
    }

    // In a real app, you would send a password reset request to your API

    // Clear any errors and show success message
    setError(null)
    setIsSubmitted(true)
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
        <div className="w-full max-w-md space-y-8">
          {!isSubmitted ? (
            <>
              <div className="text-center">
                <h1 className="text-2xl font-bold tracking-tight">Reset your password</h1>
                <p className="text-sm text-muted-foreground mt-2">
                  Enter your email address and we'll send you a link to reset your password
                </p>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <Button type="submit" className="w-full">
                  Send Reset Link
                </Button>

                <div className="text-center">
                  <Link href="/login" className="text-sm text-primary hover:underline inline-flex items-center">
                    <ArrowLeft className="mr-1 h-3 w-3" />
                    Back to login
                  </Link>
                </div>
              </form>
            </>
          ) : (
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 dark:bg-green-900 mx-auto">
                <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">Check your email</h1>
              <p className="text-sm text-muted-foreground">
                We've sent a password reset link to <span className="font-medium">{email}</span>
              </p>
              <p className="text-sm text-muted-foreground">
                If you don't see it, check your spam folder or{" "}
                <button type="button" onClick={() => setIsSubmitted(false)} className="text-primary hover:underline">
                  try again
                </button>
              </p>
              <div className="pt-4">
                <Link href="/login">
                  <Button variant="outline" className="w-full">
                    Back to login
                  </Button>
                </Link>
              </div>
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
