'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Search, Plus, Users, Mail, UserCheck, Loader2 } from 'lucide-react'
import { teamApi } from '@/lib/api'
import { toast } from 'sonner'

interface User {
  id: string
  name: string
  username: string
  email: string
  avatarUrl?: string
}

interface TeamMember extends User {
  role: string
}

interface AddTeamMemberDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  teamId: string
  teamName: string
  onMemberAdded?: () => void
}

export function AddTeamMemberDialog({
  open,
  onOpenChange,
  teamId,
  teamName,
  onMemberAdded
}: AddTeamMemberDialogProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<User[]>([])
  const [currentMembers, setCurrentMembers] = useState<TeamMember[]>([])
  const [selectedRole, setSelectedRole] = useState('member')
  const [isSearching, setIsSearching] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingMembers, setLoadingMembers] = useState(false)

  // Load current team members when dialog opens
  useEffect(() => {
    if (open && teamId) {
      loadTeamMembers()
    }
  }, [open, teamId])

  // Search users when query changes
  useEffect(() => {
    const searchUsers = async () => {
      if (searchQuery.length >= 2) {
        setIsSearching(true)
        try {
          const results = await teamApi.searchUsers(searchQuery)
          // Filter out users who are already team members
          const filteredResults = results.filter(
            (user: User) => !currentMembers.some(member => member.id === user.id)
          )
          setSearchResults(filteredResults)
        } catch (error) {
          setSearchResults([])
        } finally {
          setIsSearching(false)
        }
      } else {
        setSearchResults([])
      }
    }

    const debounceTimer = setTimeout(searchUsers, 300)
    return () => clearTimeout(debounceTimer)
  }, [searchQuery, currentMembers])

  const loadTeamMembers = async () => {
    setLoadingMembers(true)
    try {
      const members = await teamApi.getMembers(teamId)
      setCurrentMembers(members)
    } catch (error) {
      toast.error('Failed to load team members')
    } finally {
      setLoadingMembers(false)
    }
  }

  const handleAddMember = async (user: User) => {
    setIsLoading(true)
    try {

      await teamApi.addMember(teamId, {
        userId: user.id,
        role: selectedRole
      })

      toast.success(`${user.name} has been added to ${teamName}`)
      
      // Refresh team members list
      await loadTeamMembers()
      
      // Clear search and notify parent
      setSearchQuery('')
      setSearchResults([])
      onMemberAdded?.()
    } catch (error: any) {
      
      const errorMessage = error.response?.data?.message || `Failed to add team member (${error.response?.status || 'Unknown error'})`
      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'lead':
        return 'bg-red-100 text-red-800'
      case 'contributor':
        return 'bg-blue-100 text-blue-800'
      case 'member':
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'lead':
        return 'Team Lead'
      case 'contributor':
        return 'Contributor'
      case 'member':
      default:
        return 'Member'
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Add Member to {teamName}
          </DialogTitle>
          <DialogDescription>
            Search for users to add to your team. You can add users directly without sending invitations.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 overflow-hidden">
          {/* Search Section */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="search">Search Users</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search by name, username, or email..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {isSearching && (
                  <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Default Role for New Members</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="contributor">Contributor</SelectItem>
                  <SelectItem value="lead">Team Lead</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Search Results */}
          {searchQuery.length >= 2 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Search Results</Label>
              <div className="max-h-48 overflow-y-auto space-y-2">
                {searchResults.length > 0 ? (
                  searchResults.map((user) => (
                    <Card key={user.id} className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={user.avatarUrl} alt={user.name} />
                            <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{user.name}</div>
                            <div className="text-sm text-muted-foreground">@{user.username}</div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {user.email}
                            </div>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleAddMember(user)}
                          disabled={isLoading}
                          className="flex items-center gap-2"
                        >
                          {isLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Plus className="h-4 w-4" />
                          )}
                          Add
                        </Button>
                      </div>
                    </Card>
                  ))
                ) : searchQuery.length >= 2 && !isSearching ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <Search className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No users found matching "{searchQuery}"</p>
                    <p className="text-sm">Try a different search term</p>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {searchQuery.length < 2 && searchQuery.length > 0 && (
            <div className="text-center py-4 text-muted-foreground text-sm">
              Type at least 2 characters to search for users
            </div>
          )}

          <Separator />

          {/* Current Team Members */}
          <div className="space-y-2 flex-1 overflow-hidden">
            <Label className="text-sm font-medium flex items-center gap-2">
              <UserCheck className="h-4 w-4" />
              Current Team Members ({currentMembers.length})
            </Label>
            {loadingMembers ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <div className="max-h-40 overflow-y-auto space-y-2">
                {currentMembers.map((member) => (
                  <Card key={member.id} className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={member.avatarUrl} alt={member.name} />
                          <AvatarFallback>{member.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium text-sm">{member.name}</div>
                          <div className="text-xs text-muted-foreground">@{member.username}</div>
                        </div>
                      </div>
                      <Badge variant="outline" className={getRoleColor(member.role)}>
                        {getRoleLabel(member.role)}
                      </Badge>
                    </div>
                  </Card>
                ))}
                {currentMembers.length === 0 && (
                  <div className="text-center py-4 text-muted-foreground text-sm">
                    No team members yet
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}