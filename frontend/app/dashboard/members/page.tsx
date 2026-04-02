"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Search, UserPlus, MoreVertical, Crown, Shield, User, Trash2, Mail, Clock, CheckCircle, XCircle, RefreshCw } from "lucide-react"
import { useAuth } from "@/lib/authContext"
import { invitationsApi, teamApi, organizationsApi } from "@/lib/api"
import { toast } from "sonner"

interface Member {
  id: string
  name: string
  email: string
  username: string
  role: number
  avatarUrl?: string
  joinedAt?: string
}

interface Invitation {
  id: string
  email: string
  role: string
  organizationId: string
  organizationName: string
  department?: string
  jobTitle?: string
  status: "pending" | "accepted" | "declined" | "expired"
  createdAt: string
  expiresAt: string
  inviterName: string
  token?: string
}


export default function MembersPage() {
  const { user, teams, currentOrganization } = useAuth()
  const [members, setMembers] = useState<Member[]>([])
  const [sentInvitations, setSentInvitations] = useState<Invitation[]>([])
  const [receivedInvitations, setReceivedInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedRole, setSelectedRole] = useState<string>("all")
  const [selectedStatus, setSelectedStatus] = useState<string>("all")
  const [selectedTeam, setSelectedTeam] = useState<string>("all")
  const [orgInviteDialogOpen, setOrgInviteDialogOpen] = useState(false)
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [memberToRemove, setMemberToRemove] = useState<Member | null>(null)
  const [invitationToCancel, setInvitationToCancel] = useState<Invitation | null>(null)
  const [newOrgInvitation, setNewOrgInvitation] = useState({
    email: "",
    role: "member" as "admin" | "member",
    department: "",
    jobTitle: ""
  })

  useEffect(() => {
    fetchData()
  }, [teams])

  // Auto-refresh data every 15 seconds
  useEffect(() => {
    if (teams.length === 0) return // Don't start interval if no teams

    const interval = setInterval(() => {
      fetchData(false) // Don't show loading spinner for auto-refresh
    }, 15000) // 15 seconds

    return () => clearInterval(interval)
  }, [teams])

  const fetchData = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true)
      
      // Fetch organization members instead of team members to avoid duplicates
      if (currentOrganization) {
        try {
          const orgMembers = await organizationsApi.getOrganization(currentOrganization.id)
          // Assuming the organization API returns members, otherwise we need a separate endpoint
          if (orgMembers.members) {
            setMembers(orgMembers.members)
          } else {
            // Fallback: Get unique members from all teams (temporary solution)
            const allMembers: Member[] = []
            const seenUserIds = new Set()
            
            for (const team of teams) {
              try {
                const teamMembers = await teamApi.getMembers(team.id)
                teamMembers.forEach((member: any) => {
                  if (!seenUserIds.has(member.id)) {
                    seenUserIds.add(member.id)
                    allMembers.push({
                      ...member,
                      teamId: team.id,
                      teamName: team.name,
                      joinedAt: new Date().toISOString()
                    })
                  }
                })
              } catch (err) {
              }
            }
            setMembers(allMembers)
          }
        } catch (err) {
          setMembers([])
        }
      } else {
        setMembers([])
      }

      // Fetch sent invitations
      try {
        const sent = await invitationsApi.getSentInvitations()
        const formattedSent = sent.map((inv: any) => ({
          id: inv.id,
          email: inv.email,
          role: inv.role,
          organizationId: inv.organizationId,
          organizationName: inv.organizationName,
          department: inv.department,
          jobTitle: inv.jobTitle,
          status: inv.status,
          createdAt: inv.createdAt,
          expiresAt: inv.expiresAt,
          inviterName: user?.name || 'You',
          token: inv.token
        }))
        setSentInvitations(formattedSent)
      } catch (err) {
        setSentInvitations([])
      }

      // Fetch received invitations
      try {
        const received = await invitationsApi.getMyInvitations()
        const formattedReceived = received.map((inv: any) => ({
          id: inv.id,
          email: inv.email,
          role: inv.role,
          organizationId: inv.organizationId,
          organizationName: inv.organizationName,
          department: inv.department,
          jobTitle: inv.jobTitle,
          status: "pending" as const,
          createdAt: inv.createdAt,
          expiresAt: inv.expiresAt,
          inviterName: inv.inviterName,
          token: inv.token
        }))
        setReceivedInvitations(formattedReceived)
      } catch (err) {
        setReceivedInvitations([])
      }
      
    } catch (error) {
      toast.error('Failed to load members and invitations')
    } finally {
      if (showLoading) setLoading(false)
    }
  }


  const handleSendOrgInvitation = async () => {
    if (!newOrgInvitation.email || !currentOrganization) return

    try {
      // Send organization-level invitation
      await invitationsApi.createInvitation({
        email: newOrgInvitation.email,
        organizationId: currentOrganization.id,
        role: newOrgInvitation.role, // Use string role directly
        department: newOrgInvitation.department || undefined,
        jobTitle: newOrgInvitation.jobTitle || undefined
      })
      
      toast.success(`Organization invitation sent to ${newOrgInvitation.email}`)
      setOrgInviteDialogOpen(false)
      setNewOrgInvitation({ email: "", role: "member", department: "", jobTitle: "" })
      fetchData() // Refresh the data
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'Failed to send organization invitation'
      toast.error(errorMessage)
    }
  }

  const handleAcceptInvitation = async (token: string) => {
    try {
      await invitationsApi.acceptInvitation(token)
      toast.success('Invitation accepted successfully')
      fetchData()
    } catch (error) {
      toast.error('Failed to accept invitation')
    }
  }

  const handleDeclineInvitation = async (token: string) => {
    try {
      await invitationsApi.declineInvitation(token)
      toast.success('Invitation declined')
      fetchData()
    } catch (error) {
      toast.error('Failed to decline invitation')
    }
  }

  const handleRemoveMember = async () => {
    if (!memberToRemove) return

    try {
      // Use the team API to remove the member
      await teamApi.removeMember((memberToRemove as any).teamId, memberToRemove.id)
      toast.success(`${memberToRemove.name} removed from team`)
      setMembers(members.filter(m => !(m.id === memberToRemove.id && (m as any).teamId === (memberToRemove as any).teamId)))
      setRemoveDialogOpen(false)
      setMemberToRemove(null)
    } catch (error) {
      toast.error('Failed to remove member')
    }
  }

  const handleCancelInvitation = async () => {
    if (!invitationToCancel) return

    try {
      await invitationsApi.cancelInvitation(invitationToCancel.id)
      toast.success('Invitation cancelled')
      setSentInvitations(sentInvitations.filter(inv => inv.id !== invitationToCancel.id))
      setCancelDialogOpen(false)
      setInvitationToCancel(null)
    } catch (error) {
      toast.error('Failed to cancel invitation')
    }
  }

  const handleResendInvitation = async (invitation: Invitation) => {
    try {
      await invitationsApi.resendInvitation(invitation.id)
      toast.success(`Invitation resent to ${invitation.email}`)
      // Update the sent date
      setSentInvitations(sentInvitations.map(inv => 
        inv.id === invitation.id 
          ? { ...inv, createdAt: new Date().toISOString(), status: "pending" as const }
          : inv
      ))
    } catch (error) {
      toast.error('Failed to resend invitation')
    }
  }

  const getRoleIcon = (role: string | number) => {
    const roleStr = typeof role === 'number' ? (role === 0 ? 'admin' : role === 1 ? 'moderator' : 'member') : role
    switch (roleStr) {
      case 'admin':
        return <Crown className="h-4 w-4 text-yellow-500" />
      case 'moderator':
        return <Shield className="h-4 w-4 text-blue-500" />
      default: // member
        return <User className="h-4 w-4 text-gray-500" />
    }
  }

  const getRoleBadge = (role: string | number) => {
    const roleStr = typeof role === 'number' ? (role === 0 ? 'admin' : role === 1 ? 'moderator' : 'member') : role
    const roleNames: Record<string, string> = { 'admin': 'Admin', 'moderator': 'Moderator', 'member': 'Member' }
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      'admin': "destructive",
      'moderator': "secondary",
      'member': "outline"
    }
    return <Badge variant={variants[roleStr] || "outline"}>{roleNames[roleStr] || 'Member'}</Badge>
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", icon: any }> = {
      pending: { variant: "outline", icon: Clock },
      accepted: { variant: "default", icon: CheckCircle },
      declined: { variant: "destructive", icon: XCircle },
      expired: { variant: "secondary", icon: XCircle }
    }
    const config = variants[status] || variants.pending
    const Icon = config.icon
    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {status}
      </Badge>
    )
  }

  const filteredMembers = members.filter(member => {
    const matchesSearch = member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         member.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (member.username && member.username.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesRole = selectedRole === "all" || member.role.toString() === selectedRole
    const matchesTeam = selectedTeam === "all" || (member as any).teamId === selectedTeam
    return matchesSearch && matchesRole && matchesTeam
  })

  const filteredSentInvitations = sentInvitations.filter(invitation => {
    const matchesSearch = invitation.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         invitation.organizationName.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = selectedStatus === "all" || invitation.status === selectedStatus
    // For org invitations, we don't filter by team since they're org-level
    return matchesSearch && matchesStatus
  })

  const filteredReceivedInvitations = receivedInvitations.filter(invitation => {
    const matchesSearch = invitation.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         invitation.organizationName.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesSearch
  })

  const canManageMembers = user && (user.role === "admin" || user.role === "moderator" || 
    teams.some(team => team.role === 0 || team.role === 1)) // Team admin/moderator

  if (loading) {
    return (
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Team Members</h2>
            <p className="text-muted-foreground">Manage team members and invitations</p>
          </div>
        </div>
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-center space-x-4">
                  <div className="h-12 w-12 rounded-full bg-muted animate-pulse" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 w-1/3 bg-muted animate-pulse rounded" />
                    <div className="h-3 w-1/2 bg-muted animate-pulse rounded" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Team Members</h2>
          <p className="text-muted-foreground">
            Manage team members and invitations across all your teams
          </p>
        </div>
        {true && (
          <Dialog open={orgInviteDialogOpen} onOpenChange={setOrgInviteDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="mr-2 h-4 w-4" />
                Send Organization Invitation
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Send Organization Invitation</DialogTitle>
                <DialogDescription>
                  Invite someone to join your organization. They will be added to the main organization team.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="org-email">Email address</Label>
                  <Input
                    id="org-email"
                    type="email"
                    placeholder="colleague@company.com"
                    value={newOrgInvitation.email}
                    onChange={(e) => setNewOrgInvitation({...newOrgInvitation, email: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="org-role">Organization Role</Label>
                  <Select 
                    value={newOrgInvitation.role} 
                    onValueChange={(value: "admin" | "member") => setNewOrgInvitation({...newOrgInvitation, role: value})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="text-sm text-muted-foreground">
                  This will send an organization-level invitation to "{currentOrganization?.name}".
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setOrgInviteDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleSendOrgInvitation} 
                    disabled={!newOrgInvitation.email}
                  >
                    Send Organization Invitation
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Tabs defaultValue="members" className="space-y-4">
        <TabsList>
          <TabsTrigger value="members">Team Members</TabsTrigger>
          <TabsTrigger value="sent">Sent Invitations</TabsTrigger>
          <TabsTrigger value="received">Received Invitations</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search members..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="0">Admin</SelectItem>
                <SelectItem value="1">Moderator</SelectItem>
                <SelectItem value="3">Member</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedTeam} onValueChange={setSelectedTeam}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter by team" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Teams</SelectItem>
                {teams.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4">
            {filteredMembers.map((member) => (
              <Card key={`${member.id}-${(member as any).teamId}`}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={member.avatarUrl} />
                        <AvatarFallback>
                          {member.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <h3 className="text-sm font-medium">{member.name}</h3>
                          {getRoleIcon(member.role)}
                          {getRoleBadge(member.role)}
                        </div>
                        <p className="text-sm text-muted-foreground">{member.email}</p>
                        <p className="text-xs text-muted-foreground">
                          {member.username && `@${member.username} • `}
                          {(member as any).teamName}
                          {member.joinedAt && ` • Joined ${new Date(member.joinedAt).toLocaleDateString()}`}
                        </p>
                      </div>
                    </div>
                    
                    {canManageMembers && member.id !== user?.id && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => {
                              setMemberToRemove(member)
                              setRemoveDialogOpen(true)
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Remove from team
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredMembers.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">No members found matching your criteria.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="sent" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search sent invitations..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="accepted">Accepted</SelectItem>
                <SelectItem value="declined">Declined</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4">
            {filteredSentInvitations.map((invitation) => (
              <Card key={invitation.id}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <h3 className="text-sm font-medium">{invitation.email}</h3>
                        {getStatusBadge(invitation.status)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {invitation.organizationName} • {getRoleBadge(invitation.role).props.children} role
                        {invitation.department && ` • ${invitation.department}`}
                        {invitation.jobTitle && ` • ${invitation.jobTitle}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Sent {new Date(invitation.createdAt).toLocaleDateString()} • 
                        Expires {new Date(invitation.expiresAt).toLocaleDateString()}
                      </p>
                    </div>
                    
                    {canManageMembers && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {invitation.status === "pending" && (
                            <DropdownMenuItem onClick={() => handleResendInvitation(invitation)}>
                              <RefreshCw className="mr-2 h-4 w-4" />
                              Resend invitation
                            </DropdownMenuItem>
                          )}
                          {invitation.status === "pending" && (
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => {
                                setInvitationToCancel(invitation)
                                setCancelDialogOpen(true)
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Cancel invitation
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredSentInvitations.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">No sent invitations found.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="received" className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search received invitations..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="grid gap-4">
            {filteredReceivedInvitations.map((invitation) => (
              <Card key={invitation.id}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <h3 className="text-sm font-medium">Invitation to {invitation.organizationName}</h3>
                        {getStatusBadge(invitation.status)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {getRoleBadge(invitation.role).props.children} role • From {invitation.inviterName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Received {new Date(invitation.createdAt).toLocaleDateString()} • 
                        Expires {new Date(invitation.expiresAt).toLocaleDateString()}
                      </p>
                    </div>
                    
                    {invitation.status === "pending" && invitation.token && (
                      <div className="flex space-x-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleDeclineInvitation(invitation.token!)}
                        >
                          Decline
                        </Button>
                        <Button 
                          size="sm"
                          onClick={() => handleAcceptInvitation(invitation.token!)}
                        >
                          Accept
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredReceivedInvitations.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">No received invitations found.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <AlertDialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {memberToRemove?.name} from the team? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleRemoveMember}
              className="bg-red-600 hover:bg-red-700"
            >
              Remove Member
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Invitation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel the invitation to {invitationToCancel?.email}? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleCancelInvitation}
              className="bg-red-600 hover:bg-red-700"
            >
              Cancel Invitation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}