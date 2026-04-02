'use client'

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  AtSign,
  Bell,
  ChevronDown,
  FileText,
  Hash,
  Lock,
  Menu,
  MessageSquare,
  PaperclipIcon,
  Plus,
  RefreshCw,
  Search,
  Send,
  Smile,
  Star,
  Users,
} from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useMessages } from "./messagesContext"
import { formatDistanceToNow } from "date-fns"
import DirectMessageView from "./direct-message"
import { CreateChannelDialog } from "./create-channel-dialog"
import { useAuth } from "@/lib/authContext"
import { toast } from "sonner"

export default function MessagesPage() {
  const { teams } = useAuth()
  const {
    // Channel state
    channels,
    activeChannel,
    messages,
    setActiveChannel,
    sendChannelMessage,
    markChannelAsRead,
    createChannel,
    canCreateChannels,

    // Direct message state
    directContacts,
    activeDirectContact,
    setActiveDirectContact,

    // Shared state
    isLoading,
    error,
    isDirectMessageActive,
    setIsDirectMessageActive
  } = useMessages()

  const [messageInput, setMessageInput] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [showCreateChannelDialog, setShowCreateChannelDialog] = useState(false)
  const [canCreateChannelForTeams, setCanCreateChannelForTeams] = useState<Record<string, boolean>>({})
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom of messages when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages])

  // Check channel creation permissions for all teams
  useEffect(() => {
    const checkPermissions = async () => {
      const permissions: Record<string, boolean> = {}
      for (const team of teams) {
        try {
          const result = await canCreateChannels(team.id)
          permissions[team.id] = result.canCreate
        } catch (error) {
          permissions[team.id] = false
        }
      }
      setCanCreateChannelForTeams(permissions)
    }

    if (teams.length > 0) {
      checkPermissions()
    }
  }, [teams, canCreateChannels])

  // Handle send message
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (messageInput.trim()) {
      sendChannelMessage(messageInput)
      setMessageInput("")
    }
  }

  // Handle create channel
  const handleCreateChannel = async (channelData: {
    name: string
    teamId: string
    description?: string
    isPrivate?: boolean
    type?: number
  }) => {
    try {
      const newChannel = await createChannel(channelData)
      toast.success(`Channel #${channelData.name} created successfully!`)
      return newChannel
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create channel')
      throw error
    }
  }

  // Check if user can create channels in any team
  const canCreateChannelInAnyTeam = Object.values(canCreateChannelForTeams).some(Boolean)

  // Handle create channel button click
  const handleCreateChannelClick = () => {
    if (!canCreateChannelInAnyTeam) {
      toast.error('You need admin or moderator permissions to create channels')
      return
    }
    setShowCreateChannelDialog(true)
  }

  // Filter channels and contacts based on search
  const filteredChannels = channels.filter(
    channel => channel.name.toLowerCase().includes(searchInput.toLowerCase())
  )

  const filteredContacts = directContacts.filter(
    contact => contact.name.toLowerCase().includes(searchInput.toLowerCase())
  )
  
  return (
    <div className="flex h-[calc(100vh-112px)] md:h-[calc(100vh-56px)] overflow-hidden">
      <div className="w-64 flex-col bg-gray-50 border-r dark:bg-gray-900 md:flex hidden">
        <div className="flex h-12 items-center border-b px-4">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2 font-medium text-sm text-muted-foreground">Messages</div>
          </div>
        </div>
        <div className="flex-1 overflow-auto py-2">
          <div className="px-3 py-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500 dark:text-gray-400" />
              <Input
                type="search"
                placeholder="Search"
                className="w-full pl-8 text-sm"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-2">
            <div className="px-3 py-1.5 flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase">Channels</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={handleCreateChannelClick}
                disabled={!canCreateChannelInAnyTeam}
                title={canCreateChannelInAnyTeam ? "Create new channel" : "You need admin permissions to create channels"}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            <div className="mt-1">
              {filteredChannels.map(channel => (
                <Button
                  key={channel.id}
                  variant="ghost"
                  className={`w-full justify-start px-3 py-1.5 h-8 text-sm font-medium ${
                    !isDirectMessageActive && activeChannel?.id === channel.id ? 'bg-gray-200 dark:bg-gray-800' : ''
                  }`}
                  onClick={() => {
                    setActiveChannel(channel.id)
                    setIsDirectMessageActive(false)
                  }}
                >
                  {channel.isPrivate ? (
                    <Lock className="h-4 w-4 mr-2" />
                  ) : channel.type === 2 ? (
                    <Bell className="h-4 w-4 mr-2" />
                  ) : (
                    <Hash className="h-4 w-4 mr-2" />
                  )}
                  {channel.name}
                  {channel.unreadCount && channel.unreadCount > 0 && (
                    <Badge variant="secondary" className="ml-auto">
                      {channel.unreadCount}
                    </Badge>
                  )}
                </Button>
              ))}
            </div>
          </div>
          <div className="mt-4">
            <div className="px-3 py-1.5 flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase">Direct Messages</span>
              <Button variant="ghost" size="icon" className="h-5 w-5">
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            <div className="mt-1">
              {filteredContacts.map(contact => (
                <Button
                  key={contact.id}
                  variant="ghost"
                  className={`w-full justify-start px-3 py-1.5 h-8 text-sm font-medium ${
                    isDirectMessageActive && activeDirectContact?.id === contact.id ? 'bg-gray-200 dark:bg-gray-800' : ''
                  }`}
                  onClick={() => {
                    setActiveDirectContact(contact.id)
                    setIsDirectMessageActive(true)
                  }}
                >
                  <div className="relative mr-2">
                    <div className={`h-4 w-4 rounded-full ${
                      contact.status === 'online' ? 'bg-green-500' : 'bg-gray-300'
                    }`}></div>
                  </div>
                  {contact.name}
                  {contact.unreadCount && contact.unreadCount > 0 && (
                    <Badge variant="secondary" className="ml-auto">
                      {contact.unreadCount}
                    </Badge>
                  )}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile Message Type Selector */}
        <div className="md:hidden flex border-b bg-background">
          <Button
            variant={isDirectMessageActive ? "ghost" : "default"}
            className="flex-1 rounded-none h-10"
            onClick={() => setIsDirectMessageActive(false)}
          >
            <Hash className="h-4 w-4 mr-2" />
            <span className="text-sm">Channels</span>
          </Button>
          <Button
            variant={isDirectMessageActive ? "default" : "ghost"}
            className="flex-1 rounded-none h-10"
            onClick={() => setIsDirectMessageActive(true)}
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            <span className="text-sm">Direct Messages</span>
          </Button>
        </div>

        {/* Mobile Sidebar Toggle */}
        <div className="md:hidden p-2 border-b bg-background">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={() => {
              // Toggle mobile sidebar
            }}
          >
            <Menu className="h-4 w-4 mr-2" />
            Browse {isDirectMessageActive ? 'Direct Messages' : 'Channels'}
          </Button>
        </div>

        {/* Welcome screen */}
        {!activeChannel && !activeDirectContact && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-2">Welcome to Messages</h2>
              <p className="text-muted-foreground mb-4">Choose a channel or direct message to start chatting</p>
              <div className="flex justify-center gap-4">
                <Button 
                  onClick={handleCreateChannelClick}
                  disabled={!canCreateChannelInAnyTeam}
                >
                  <Hash className="h-4 w-4 mr-2" />
                  Create Channel
                </Button>
                <Button onClick={() => {
                  // Open direct message dialog
                }}>
                  <MessageSquare className="h-4 w-4 mr-2" />
                  New Message
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Channel View */}
        {activeChannel && !isDirectMessageActive && (
          <>
            {/* Channel Header */}
            <header className="flex h-12 items-center justify-between border-b bg-white px-4 dark:bg-gray-950">
              <div className="flex items-center">
                <div className="flex items-center gap-2">
                  {activeChannel.isPrivate ? (
                    <Lock className="h-5 w-5 mr-2 text-gray-500" />
                  ) : activeChannel.type === 2 ? (
                    <Bell className="h-5 w-5 mr-2 text-gray-500" />
                  ) : (
                    <Hash className="h-5 w-5 mr-2 text-gray-500" />
                  )}
                  <h1 className="font-semibold">{activeChannel.name}</h1>
                  {activeChannel.isDefault && (
                    <Badge variant="outline" className="ml-2">Default</Badge>
                  )}
                  {isLoading && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground ml-2">
                      <RefreshCw className="h-3 w-3 animate-spin" />
                      <span>Syncing...</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 sm:gap-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Users className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Show members</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Star className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Star channel</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <div className="relative hidden sm:block">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500 dark:text-gray-400" />
                  <Input type="search" placeholder="Search in channel" className="w-48 pl-8 text-sm" />
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <Bell className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Notification preferences</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </header>

            {/* Messages Area */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-6">
                {/* Day Separator */}
                <div className="relative flex items-center py-2">
                  <div className="flex-grow border-t"></div>
                  <span className="mx-4 flex-shrink text-xs text-gray-500">Today</span>
                  <div className="flex-grow border-t"></div>
                </div>

                {isLoading ? (
                  <div className="text-center text-gray-500 py-10">
                    Loading messages...
                  </div>
                ) : messages.length > 0 ? (
                  messages.map((message) => (
                    <div key={message.id} className="flex gap-3">
                      <Avatar>
                        <AvatarImage src={message.sender.avatar || "/placeholder-user.jpg"} alt={message.sender.name} />
                        <AvatarFallback>{message.sender.name[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{message.sender.name}</span>
                          <span className="text-xs text-gray-500">
                            {message.timestamp instanceof Date
                              ? formatDistanceToNow(message.timestamp, { addSuffix: true })
                              : formatDistanceToNow(new Date(message.timestamp), { addSuffix: true })}
                          </span>
                        </div>
                        <div className="mt-1">
                          <p>{message.content}</p>
                          <div className="mt-2 flex items-center gap-2">
                            <Button variant="outline" size="sm" className="h-7 rounded-full px-3 text-xs">
                              👍
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 rounded-full p-0">
                              <Smile className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-gray-500 py-10">
                    No messages yet. Be the first to send a message!
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Message Input */}
            <div className="border-t p-4">
              <form onSubmit={handleSendMessage} className="rounded-lg border bg-white dark:bg-gray-950">
                <div className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8">
                      <PaperclipIcon className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8">
                      <AtSign className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8">
                      <Smile className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Separator />
                <div className="flex items-center p-3">
                  <Input
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    placeholder={`Message #${activeChannel.name}`}
                    className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                  <Button type="submit" size="icon" className="ml-2 rounded-full">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </form>
            </div>
          </>
        )}

        {/* Direct Message View */}
        {isDirectMessageActive && activeDirectContact && (
          <DirectMessageView />
        )}
      </div>

      {/* Create Channel Dialog */}
      <CreateChannelDialog
        open={showCreateChannelDialog}
        onOpenChange={setShowCreateChannelDialog}
        onCreateChannel={handleCreateChannel}
      />
    </div>
  )
}