"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { TeamagerLogo } from "@/components/teamager-logo"
import { CheckCircle2, X, Clock, User, Users } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import axios from 'axios'

interface InvitationDetails {
  invitation: {
    id: string
    email: string
    role: number
    createdAt: string
    expiresAt: string
  }
  team: {
    id: string
    name: string
  }
  inviter: {
    id: string
    name: string
  } | null
}

export default function InvitePage({ params }: { params: { token: string } }) {
  const router = useRouter()
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [acceptLoading, setAcceptLoading] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  // Check if user is logged in using HTTP-only cookies
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // With HTTP-only cookies, we need to check with the server
        const response = await axios.get('/api/user/me', { withCredentials: true })
        if (response.data?.id) {
          setIsAuthenticated(true)
        }
      } catch (error) {
        // User is not authenticated
        setIsAuthenticated(false)
      }
    }

    checkAuth()
  }, [])

  // Fetch invitation details
  useEffect(() => {
    const fetchInvitation = async () => {
      try {
        const response = await axios.get(`/api/invitations/validate/${params.token}`, {
          withCredentials: true
        })
        setInvitation(response.data)
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to load invitation details')
      } finally {
        setLoading(false)
      }
    }

    if (params.token) {
      fetchInvitation()
    }
  }, [params.token])

  const handleAccept = async () => {
    if (!isAuthenticated) {
      // If not logged in, redirect to login with invitation token as query param
      router.push(`/login?invitation=${params.token}`)
      return
    }

    setAcceptLoading(true)
    try {
      await axios.post(`/api/invitations/accept/${params.token}`, {}, {
        withCredentials: true
      })
      setAccepted(true)

      // Redirect to dashboard after a short delay
      setTimeout(() => {
        router.push('/dashboard')
      }, 2000)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to accept invitation')
    } finally {
      setAcceptLoading(false)
    }
  }

  const handleDecline = () => {
    router.push('/')
  }

  // Format date to be more readable
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  }

  // Check if invitation is expired
  const isExpired = invitation && new Date(invitation.invitation.expiresAt) < new Date()

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
            <CardContent className="pt-6 space-y-6">
              {loading ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Skeleton className="h-8 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-20 w-full rounded-md" />
                  </div>
                  <div className="flex justify-center gap-3">
                    <Skeleton className="h-10 w-28" />
                    <Skeleton className="h-10 w-28" />
                  </div>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center text-center space-y-4 py-6">
                  <div className="rounded-full bg-destructive/10 p-3">
                    <X className="h-12 w-12 text-destructive" />
                  </div>
                  <h1 className="text-2xl font-bold">Invitation Error</h1>
                  <p className="text-muted-foreground">{error}</p>
                  <Button asChild>
                    <Link href="/">Return to Home</Link>
                  </Button>
                </div>
              ) : accepted ? (
                <div className="flex flex-col items-center justify-center text-center space-y-4 py-6">
                  <div className="rounded-full bg-primary/10 p-3">
                    <CheckCircle2 className="h-12 w-12 text-primary" />
                  </div>
                  <h1 className="text-2xl font-bold">Invitation Accepted!</h1>
                  <p className="text-muted-foreground">
                    You've successfully joined {invitation?.team.name}. Redirecting to dashboard...
                  </p>
                </div>
              ) : isExpired ? (
                <div className="flex flex-col items-center justify-center text-center space-y-4 py-6">
                  <div className="rounded-full bg-destructive/10 p-3">
                    <Clock className="h-12 w-12 text-destructive" />
                  </div>
                  <h1 className="text-2xl font-bold">Invitation Expired</h1>
                  <p className="text-muted-foreground">
                    This invitation has expired. Please contact the team administrator for a new invitation.
                  </p>
                  <Button asChild>
                    <Link href="/">Return to Home</Link>
                  </Button>
                </div>
              ) : (
                <>
                  <div className="space-y-2 text-center">
                    <h1 className="text-2xl font-bold">Team Invitation</h1>
                    <p className="text-muted-foreground">
                      You've been invited to join {invitation?.team.name}
                    </p>
                  </div>

                  <div className="rounded-lg border p-4 space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="rounded-md bg-primary/10 p-1.5">
                        <Users className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-medium">Team</h3>
                        <p className="text-sm text-muted-foreground">
                          {invitation?.team.name}
                        </p>
                      </div>
                    </div>

                    {invitation?.inviter && (
                      <div className="flex items-start gap-3">
                        <div className="rounded-md bg-primary/10 p-1.5">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-medium">Invited by</h3>
                          <p className="text-sm text-muted-foreground">
                            {invitation.inviter.name}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="flex items-start gap-3">
                      <div className="rounded-md bg-primary/10 p-1.5">
                        <Clock className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-medium">Expires on</h3>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(invitation?.invitation.expiresAt || '')}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-center gap-3">
                    <Button
                      variant="outline"
                      onClick={handleDecline}
                    >
                      Decline
                    </Button>
                    <Button
                      onClick={handleAccept}
                      disabled={acceptLoading}
                    >
                      {acceptLoading ? "Processing..." : isAuthenticated ? "Accept Invitation" : "Sign in to Accept"}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <footer className="py-6 text-center text-sm text-muted-foreground">
        <p>&copy; 2025 Teamager. All rights reserved.</p>
      </footer>
    </div>
  )
}