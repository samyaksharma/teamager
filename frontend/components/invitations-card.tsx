"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Briefcase, Mail, Calendar, Check } from "lucide-react"
import { useRouter } from "next/navigation"
import { Skeleton } from "@/components/ui/skeleton"
import { invitationsApi } from "@/lib/api"

interface Invitation {
  id: string
  token: string
  role: number
  createdAt: string
  expiresAt: string
  team: {
    id: string
    name: string
  }
  inviter: {
    id: string
    name: string
  }
}

export function InvitationsCard() {
  const router = useRouter()
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [processingId, setProcessingId] = useState<string | null>(null)

  useEffect(() => {
    const fetchInvitations = async () => {
      try {
        const invitations = await invitationsApi.getMyInvitations()
        setInvitations(invitations)
      } catch (err: any) {
        setError(err.response?.data?.message || "Failed to load invitations")
      } finally {
        setLoading(false)
      }
    }

    fetchInvitations()
  }, [])

  const handleAccept = async (token: string, id: string) => {
    setProcessingId(id)
    try {
      await invitationsApi.acceptInvitation(token)
      // Remove the invitation from the list
      setInvitations(invitations.filter(inv => inv.id !== id))
      router.refresh()
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to accept invitation")
    } finally {
      setProcessingId(null)
    }
  }

  // Format date to be more readable
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    })
  }

  // Check if there are any invitations to display
  if (!loading && invitations.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pending Invitations</CardTitle>
        <CardDescription>Teams you have been invited to join</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : (
          <div className="space-y-4">
            {invitations.map((invitation) => (
              <div key={invitation.id} className="border rounded-lg p-4">
                <div className="flex items-start gap-4">
                  <div className="rounded-md bg-primary/10 p-1.5">
                    <Briefcase className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium">{invitation.team.name}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Mail className="h-3.5 w-3.5" />
                        <span>Invited by {invitation.inviter.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>Expires {formatDate(invitation.expiresAt)}</span>
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleAccept(invitation.token, invitation.id)}
                    disabled={processingId === invitation.id}
                  >
                    {processingId === invitation.id ? (
                      "Accepting..."
                    ) : (
                      <>
                        <Check className="mr-1 h-3 w-3" /> Accept
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}