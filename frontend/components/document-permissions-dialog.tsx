'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Trash2, UserPlus, Users, Crown, Eye, MessageSquare, Edit, Shield, Search } from 'lucide-react'
import { documentsApi } from '@/lib/api'
import { teamAPI, usersApi } from '@/lib/api'
import { useAuth } from '@/lib/authContext'

interface DocumentPermission {
  id: string
  userId?: string
  teamId?: string
  role: 'viewer' | 'commenter' | 'editor' | 'admin'
  userName?: string
  userEmail?: string
  teamName?: string
}

interface DocumentOwner {
  ownerId: string
  ownerName: string
  ownerEmail: string
}

interface DocumentPermissionsDialogProps {
  documentId: string
  canManagePermissions: boolean
  trigger?: React.ReactNode
  onPermissionsUpdated?: () => void
}

const roleIcons = {
  viewer: Eye,
  commenter: MessageSquare, 
  editor: Edit,
  admin: Shield
}

const roleDescriptions = {
  viewer: 'Can view the document',
  commenter: 'Can view and add comments',
  editor: 'Can view, comment, and edit',
  admin: 'Can view, edit, and manage permissions'
}

export default function DocumentPermissionsDialog({ 
  documentId, 
  canManagePermissions,
  trigger,
  onPermissionsUpdated
}: DocumentPermissionsDialogProps) {
  const { teams } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [permissions, setPermissions] = useState<DocumentPermission[]>([])
  const [owner, setOwner] = useState<DocumentOwner | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Add permission form state
  const [isAddingPermission, setIsAddingPermission] = useState(false)
  const [addType, setAddType] = useState<'user' | 'team'>('user')
  const [selectedRole, setSelectedRole] = useState<'viewer' | 'commenter' | 'editor' | 'admin'>('viewer')
  const [userSearch, setUserSearch] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [selectedTeam, setSelectedTeam] = useState('')

  const fetchPermissions = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await documentsApi.getDocumentPermissions(documentId)
      setPermissions(data.roles || [])
      setOwner(data.owner)
    } catch (err: any) {
      console.error('Failed to fetch permissions:', err)
      setError(err.response?.data?.message || 'Failed to load permissions')
    } finally {
      setLoading(false)
    }
  }

  const searchUsers = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([])
      return
    }

    try {
      const results = await teamAPI.searchUsers(query, 10)
      setSearchResults(results || [])
    } catch (err) {
      console.error('Failed to search users:', err)
      setSearchResults([])
    }
  }

  const handleAddPermission = async () => {
    try {
      setLoading(true)
      
      const assignmentData: any = { role: selectedRole }
      
      if (addType === 'user') {
        if (!selectedUser) {
          alert('Please select a user')
          return
        }
        assignmentData.userId = selectedUser.id
      } else {
        if (!selectedTeam) {
          alert('Please select a team')
          return
        }
        assignmentData.teamId = selectedTeam
      }

      await documentsApi.assignDocumentRole(documentId, assignmentData)
      
      // Reset form
      setSelectedUser(null)
      setSelectedTeam('')
      setUserSearch('')
      setSearchResults([])
      setSelectedRole('viewer')
      setIsAddingPermission(false)
      
      // Refresh permissions
      await fetchPermissions()
      
      // Notify parent component that permissions were updated
      onPermissionsUpdated?.()
    } catch (err: any) {
      console.error('Failed to add permission:', err)
      alert(err.response?.data?.message || 'Failed to add permission')
    } finally {
      setLoading(false)
    }
  }

  const handleRemovePermission = async (permission: DocumentPermission) => {
    try {
      setLoading(true)
      
      const removalData: any = {}
      if (permission.userId) removalData.userId = permission.userId
      if (permission.teamId) removalData.teamId = permission.teamId

      await documentsApi.removeDocumentRole(documentId, removalData)
      
      // Refresh permissions
      await fetchPermissions()
      
      // Notify parent component that permissions were updated
      onPermissionsUpdated?.()
    } catch (err: any) {
      console.error('Failed to remove permission:', err)
      alert(err.response?.data?.message || 'Failed to remove permission')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchPermissions()
    }
  }, [isOpen, documentId])

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      searchUsers(userSearch)
    }, 300)

    return () => clearTimeout(debounceTimer)
  }, [userSearch])

  const getRoleIcon = (role: string) => {
    const Icon = roleIcons[role as keyof typeof roleIcons] || Eye
    return <Icon className="w-4 h-4" />
  }

  const defaultTrigger = (
    <Button variant="outline" size="sm" className="gap-1">
      <Users className="w-4 h-4" />
      Permissions
    </Button>
  )

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Document Permissions</DialogTitle>
          <DialogDescription>
            Manage who can access and edit this document
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {error && (
            <div className="bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-200 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* Owner Section */}
          {owner && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Crown className="w-4 h-4 text-yellow-500" />
                  Owner
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{owner.ownerName}</div>
                    <div className="text-sm text-muted-foreground">{owner.ownerEmail}</div>
                  </div>
                  <Badge variant="secondary">Full Access</Badge>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Permissions List */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-sm">Shared With</CardTitle>
                <CardDescription>Users and teams with access</CardDescription>
              </div>
              {canManagePermissions && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setIsAddingPermission(true)}
                  className="gap-1"
                >
                  <UserPlus className="w-4 h-4" />
                  Add
                </Button>
              )}
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              {loading && permissions.length === 0 && (
                <div className="text-center py-4 text-muted-foreground">
                  Loading permissions...
                </div>
              )}
              
              {!loading && permissions.length === 0 && (
                <div className="text-center py-4 text-muted-foreground">
                  This document is not shared with anyone
                </div>
              )}

              {permissions.map((permission) => (
                <div key={permission.id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                      {permission.userId ? (
                        <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                          {permission.userName?.charAt(0)?.toUpperCase() || 'U'}
                        </span>
                      ) : (
                        <Users className="w-4 h-4 text-blue-700 dark:text-blue-300" />
                      )}
                    </div>
                    <div>
                      <div className="font-medium">
                        {permission.userName || permission.teamName}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {permission.userEmail || `Team: ${permission.teamName}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="gap-1">
                      {getRoleIcon(permission.role)}
                      {permission.role}
                    </Badge>
                    {canManagePermissions && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemovePermission(permission)}
                        disabled={loading}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Add Permission Form */}
          {isAddingPermission && canManagePermissions && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Add Permission</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Button
                    variant={addType === 'user' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setAddType('user')}
                  >
                    User
                  </Button>
                  <Button
                    variant={addType === 'team' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setAddType('team')}
                  >
                    Team
                  </Button>
                </div>

                {addType === 'user' ? (
                  <div className="space-y-2">
                    <Label>Search Users</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                      <Input
                        placeholder="Type to search users..."
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    {searchResults.length > 0 && (
                      <div className="border rounded-md max-h-32 overflow-y-auto">
                        {searchResults.map((user) => (
                          <div
                            key={user.id}
                            className="p-2 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer border-b last:border-0"
                            onClick={() => {
                              setSelectedUser(user)
                              setUserSearch(user.name)
                              setSearchResults([])
                            }}
                          >
                            <div className="font-medium">{user.name}</div>
                            <div className="text-sm text-muted-foreground">{user.email}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {selectedUser && (
                      <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded border">
                        <div className="font-medium">{selectedUser.name}</div>
                        <div className="text-sm text-muted-foreground">{selectedUser.email}</div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Select Team</Label>
                    <Select value={selectedTeam} onValueChange={setSelectedTeam}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a team" />
                      </SelectTrigger>
                      <SelectContent>
                        {teams.map((team) => (
                          <SelectItem key={team.id} value={team.id}>
                            {team.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={selectedRole} onValueChange={(value) => setSelectedRole(value as 'viewer' | 'commenter' | 'editor' | 'admin')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(roleDescriptions).map(([role, description]) => (
                        <SelectItem key={role} value={role}>
                          <div className="flex items-center gap-2">
                            {getRoleIcon(role)}
                            <div>
                              <div className="font-medium capitalize">{role}</div>
                              <div className="text-xs text-muted-foreground">{description}</div>
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleAddPermission} disabled={loading} size="sm">
                    Add Permission
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setIsAddingPermission(false)
                      setSelectedUser(null)
                      setSelectedTeam('')
                      setUserSearch('')
                      setSearchResults([])
                    }}
                    size="sm"
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}