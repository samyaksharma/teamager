'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Hash, Lock, Bell } from 'lucide-react'
import { useAuth } from '@/lib/authContext'
import { channelsApi } from '@/lib/api'
import { toast } from 'sonner'

interface CreateChannelDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreateChannel: (channelData: {
    name: string
    teamId: string
    description?: string
    isPrivate?: boolean
    type?: number
  }) => Promise<void>
}

export function CreateChannelDialog({
  open,
  onOpenChange,
  onCreateChannel
}: CreateChannelDialogProps) {
  const { teams } = useAuth()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    teamId: '',
    isPrivate: false,
    type: 0, // 0 = text channel, 2 = announcement channel
    addAllTeamMembers: true // New option to add all team members
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim() || !formData.teamId) return

    setLoading(true)
    try {
      const newChannel = await onCreateChannel({
        name: formData.name.trim(),
        teamId: formData.teamId,
        description: formData.description.trim() || undefined,
        isPrivate: formData.isPrivate,
        type: formData.type
      })

      // If option is selected, add all team members to the channel
      if (formData.addAllTeamMembers && newChannel?.id) {
        try {
          const result = await channelsApi.addAllTeamMembers(newChannel.id, formData.teamId)
          toast.success(`Channel created! ${result.memberCount} team members have been notified.`)
        } catch (memberError) {
          toast.warning('Channel created, but failed to notify all team members.')
        }
      }

      // Reset form
      setFormData({
        name: '',
        description: '',
        teamId: '',
        isPrivate: false,
        type: 0,
        addAllTeamMembers: true
      })
      onOpenChange(false)
    } catch (error) {
    } finally {
      setLoading(false)
    }
  }

  const getChannelIcon = () => {
    if (formData.isPrivate) return <Lock className="h-4 w-4" />
    if (formData.type === 2) return <Bell className="h-4 w-4" />
    return <Hash className="h-4 w-4" />
  }

  const formatChannelName = (name: string) => {
    return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create a channel</DialogTitle>
          <DialogDescription>
            Channels are where your team communicates. They're best when organized around a topic — #marketing, for example.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="team">Team</Label>
            <Select 
              value={formData.teamId} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, teamId: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a team" />
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

          <div className="space-y-2">
            <Label htmlFor="name">Channel name</Label>
            <div className="relative">
              <div className="absolute left-3 top-3 text-muted-foreground">
                {getChannelIcon()}
              </div>
              <Input
                id="name"
                placeholder="e.g. plan-budget"
                className="pl-10"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  name: formatChannelName(e.target.value)
                }))}
                required
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Channel names must be lowercase, without spaces or periods, and can't be longer than 21 characters.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              placeholder="What's this channel about?"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="private">Make private</Label>
                <p className="text-xs text-muted-foreground">
                  Only invited team members can see and join private channels
                </p>
              </div>
              <Switch
                id="private"
                checked={formData.isPrivate}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isPrivate: checked }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="addMembers">Add all team members</Label>
                <p className="text-xs text-muted-foreground">
                  Automatically notify all team members about this new channel
                </p>
              </div>
              <Switch
                id="addMembers"
                checked={formData.addAllTeamMembers}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, addAllTeamMembers: checked }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Channel type</Label>
              <Select 
                value={formData.type.toString()} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, type: parseInt(value) }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">
                    <div className="flex items-center gap-2">
                      <Hash className="h-4 w-4" />
                      Text Channel
                    </div>
                  </SelectItem>
                  <SelectItem value="2">
                    <div className="flex items-center gap-2">
                      <Bell className="h-4 w-4" />
                      Announcement Channel
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={!formData.name.trim() || !formData.teamId || loading}
            >
              {loading ? 'Creating...' : 'Create Channel'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}