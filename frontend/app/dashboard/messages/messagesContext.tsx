'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { useSocket } from '@/lib/socketContext'
import { channelsApi, directMessagesApi, teamApi } from '@/lib/api'
import { useAuth } from '@/lib/authContext'
import { toast } from 'sonner'

interface User {
  id: string
  name: string
  username?: string
  avatar?: string
  status?: 'online' | 'offline' | 'away'
  unreadCount?: number
}

export interface Reaction {
  emoji: string
  count: number
  userIds: string[]
}

export interface Message {
  id: string
  sender: {
    id: string
    name: string
    avatar?: string
  }
  content: string
  timestamp: Date
  channelId: string
  pinnedAt?: string | null
  reactions?: Reaction[]
  replyCount?: number
  taskId?: string | null
  mentions?: { userId: string; username: string; name: string }[]
  linkedTasks?: { id: string; title: string }[]
}

// Convert an API message row into the shape the UI uses
export const normalizeMessage = (raw: any): Message => ({
  id: raw.id,
  sender: {
    id: raw.sender?.id ?? raw.userId,
    name: raw.sender?.name ?? raw.userName ?? 'Unknown',
    avatar: raw.sender?.avatar ?? raw.userAvatar ?? undefined
  },
  content: raw.content,
  timestamp: new Date(raw.timestamp ?? raw.createdAt),
  channelId: raw.channelId,
  pinnedAt: raw.pinnedAt ?? null,
  reactions: raw.reactions ?? [],
  replyCount: raw.replyCount ?? 0,
  taskId: raw.taskId ?? null,
  mentions: raw.mentions ?? [],
  linkedTasks: raw.linkedTasks ?? []
})

interface DirectMessage {
  id: string
  senderId: string
  receiverId: string
  content: string
  timestamp: Date
  readAt?: Date
  isDeleted?: boolean
  sender?: User
  receiver?: User
}

// Convert an API direct message row into the shape the UI uses
export const normalizeDirectMessage = (raw: any): DirectMessage => ({
  id: raw.id,
  senderId: raw.senderId,
  receiverId: raw.receiverId,
  content: raw.content,
  timestamp: new Date(raw.timestamp ?? raw.createdAt),
  readAt: raw.readAt ? new Date(raw.readAt) : undefined,
  isDeleted: !!raw.deletedAt,
  sender: raw.sender ?? { id: raw.senderId, name: raw.senderName ?? 'Unknown', avatar: raw.senderAvatar ?? undefined }
})

interface Channel {
  id: string
  name: string
  description?: string
  type: number
  isPrivate: boolean
  isDefault: boolean
  teamId: string
  members?: string[]
  unreadCount?: number
  lastMessage?: {
    content: string
    timestamp: Date
  }
}

interface MessagesContextType {
  channels: Channel[]
  activeChannel: Channel | null
  messages: Message[]
  setActiveChannel: (channelId: string) => void
  sendChannelMessage: (content: string) => Promise<void>
  toggleMessagePin: (messageId: string) => Promise<void>
  toggleReaction: (messageId: string, emoji: string, threadParentId?: string) => Promise<void>
  createTaskFromMessage: (messageId: string) => Promise<void>
  threadParent: Message | null
  threadReplies: Message[]
  openThread: (messageId: string) => Promise<void>
  closeThread: () => void
  sendThreadReply: (content: string) => Promise<void>
  currentUserId: string | undefined
  markChannelAsRead: (channelId: string) => void
  createChannel: (channelData: { name: string, teamId: string, description?: string, isPrivate?: boolean, type?: number }) => Promise<Channel>
  canCreateChannels: (teamId: string) => Promise<{ canCreate: boolean, reason?: string }>

  directContacts: User[]
  activeDirectContact: User | null
  directMessages: DirectMessage[]
  setActiveDirectContact: (userId: string) => void
  sendDirectMessage: (content: string) => Promise<void>
  markDirectMessageAsRead: (messageId: string) => Promise<void>
  markAllDirectMessagesAsRead: () => Promise<void>

  isLoading: boolean
  error: string | null
  isDirectMessageActive: boolean
  setIsDirectMessageActive: (value: boolean) => void
}

const MessagesContext = createContext<MessagesContextType>({
  channels: [],
  activeChannel: null,
  messages: [],
  setActiveChannel: () => {},
  sendChannelMessage: async () => {},
  toggleMessagePin: async () => {},
  toggleReaction: async () => {},
  createTaskFromMessage: async () => {},
  threadParent: null,
  threadReplies: [],
  openThread: async () => {},
  closeThread: () => {},
  sendThreadReply: async () => {},
  currentUserId: undefined,
  markChannelAsRead: () => {},
  createChannel: async () => ({} as Channel),
  canCreateChannels: async () => ({ canCreate: false }),

  directContacts: [],
  activeDirectContact: null,
  directMessages: [],
  setActiveDirectContact: () => {},
  sendDirectMessage: async () => {},
  markDirectMessageAsRead: async () => {},
  markAllDirectMessagesAsRead: async () => {},

  isLoading: false,
  error: null,
  isDirectMessageActive: false,
  setIsDirectMessageActive: () => {}
})

export const useMessages = () => useContext(MessagesContext)

export const MessagesProvider = ({ children }: { children: React.ReactNode }) => {
  const { joinRoom } = useSocket()
  const { user: authUser, teams } = useAuth()

  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [isDirectMessageActive, setIsDirectMessageActive] = useState<boolean>(false)

  const [channels, setChannels] = useState<Channel[]>([])
  const [activeChannel, setActiveChannelState] = useState<Channel | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [threadParent, setThreadParent] = useState<Message | null>(null)
  const [threadReplies, setThreadReplies] = useState<Message[]>([])

  const [directContacts, setDirectContacts] = useState<User[]>([])
  const [activeDirectContact, setActiveDirectContactState] = useState<User | null>(null)
  const [directMessages, setDirectMessages] = useState<DirectMessage[]>([])

  const currentUser = authUser ? {
    id: authUser.id,
    name: authUser.name,
    username: authUser.username,
    avatar: authUser.avatarUrl
  } : {
    id: 'current-user',
    name: 'Current User'
  }
  
  const [currentTeamId, setCurrentTeamId] = useState<string | null>(null)

  useEffect(() => {
    const fetchChannels = async () => {
      setIsLoading(true)
      try {
        let allChannels: Channel[] = []
        
        for (const team of teams) {
          try {
            const teamChannels = await channelsApi.getAllChannels(team.id)
            allChannels = [...allChannels, ...teamChannels]
          } catch (err) {
          }
        }
        
        setChannels(allChannels)

        if (allChannels.length > 0 && !activeChannel) {
          const defaultChannel = allChannels.find(c => c.isDefault) || allChannels[0]
          setActiveChannelState(defaultChannel)
        }
      } catch (err) {
        setError('Failed to load channels')

        setChannels([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchChannels()
  }, [teams])

  // Load direct message contacts: everyone who shares a team with the current user, with unread counts
  const activeContactId = activeDirectContact?.id
  useEffect(() => {
    if (!authUser || teams.length === 0) return

    const fetchContacts = async () => {
      try {
        const [memberLists, unread] = await Promise.all([
          Promise.all(teams.map(team => teamApi.getMembers(team.id).catch(() => []))),
          directMessagesApi.getUnreadMessages().catch(() => [])
        ])

        const unreadBySender = new Map<string, number>()
        for (const message of unread) {
          unreadBySender.set(message.senderId, (unreadBySender.get(message.senderId) ?? 0) + 1)
        }

        const byId = new Map<string, User>()
        for (const member of memberLists.flat()) {
          if (member.id === authUser.id || byId.has(member.id)) continue
          byId.set(member.id, {
            id: member.id,
            name: member.name,
            username: member.username,
            avatar: member.avatarUrl ?? undefined,
            unreadCount: member.id === activeContactId ? 0 : unreadBySender.get(member.id) ?? 0
          })
        }
        setDirectContacts([...byId.values()].sort((a, b) => a.name.localeCompare(b.name)))
      } catch (err) {
      }
    }

    fetchContacts()
    const intervalId = setInterval(fetchContacts, 10000)
    return () => clearInterval(intervalId)
  }, [authUser?.id, teams, activeContactId])

  useEffect(() => {
    if (!activeChannel || isDirectMessageActive) return

    const fetchMessages = async () => {
      setIsLoading(true)
      try {
        joinRoom(activeChannel.id)

        const response = await channelsApi.getMessages(activeChannel.id)
        setMessages(response.map(normalizeMessage))

        markChannelAsRead(activeChannel.id)
      } catch (err) {
        setError('Failed to load messages')

        setMessages([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchMessages()
  }, [activeChannel, isDirectMessageActive, joinRoom])

  useEffect(() => {
    if (!activeDirectContact || !isDirectMessageActive) return

    const fetchDirectMessages = async () => {
      setIsLoading(true)
      try {
        const response = await directMessagesApi.getMessagesWithUser(activeDirectContact.id)
        setDirectMessages(response.map(normalizeDirectMessage))

        await markAllDirectMessagesAsRead()
      } catch (err) {
        setError('Failed to load direct messages')

        setDirectMessages([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchDirectMessages()
  }, [activeDirectContact, isDirectMessageActive, currentUser.id])

  // Poll for new channel messages instead of using WebSockets
  useEffect(() => {
    if (!activeChannel || isDirectMessageActive) return
    
    // Function to refresh the channel's messages (also picks up reactions and reply counts)
    const fetchNewMessages = async () => {
      try {
        const latest = await channelsApi.getMessages(activeChannel.id)
        setMessages(latest.map(normalizeMessage))
      } catch (err) {
      }
    };
    
    fetchNewMessages();
    
    const intervalId = setInterval(fetchNewMessages, 3000);
    
    return () => {
      clearInterval(intervalId);
    };
  }, [activeChannel, isDirectMessageActive])

  // Poll for new direct messages instead of using WebSockets
  useEffect(() => {
    if (!isDirectMessageActive || !activeDirectContact) return
    
    const fetchNewDirectMessages = async () => {
      try {
        const latest = (await directMessagesApi.getMessagesWithUser(activeDirectContact.id)).map(normalizeDirectMessage)
        setDirectMessages(latest)

        for (const message of latest) {
          if (message.senderId === activeDirectContact.id && !message.readAt) {
            directMessagesApi.markAsRead(message.id).catch(() => {})
          }
        }
      } catch (err) {
      }
    };
    
    fetchNewDirectMessages();
    
    const intervalId = setInterval(fetchNewDirectMessages, 3000);
    
    return () => {
      clearInterval(intervalId);
    };
  }, [activeDirectContact, isDirectMessageActive])

  // Poll for user status updates instead of using WebSockets
  useEffect(() => {
    // We'd normally implement a polling mechanism here to fetch user statuses
    // For now, we'll just simulate online/offline status
    
    const updateUserStatuses = () => {
      // This would be an API call in a real implementation
      // For now, just simulate random status changes occasionally
      if (Math.random() > 0.9) {
        setDirectContacts(prevContacts => {
          return prevContacts.map(contact => {
            if (Math.random() > 0.9) {
              const newStatus = contact.status === 'online' ? 'offline' : 'online'
              return { ...contact, status: newStatus }
            }
            return contact
          })
        })
      }
    }
    
    const intervalId = setInterval(updateUserStatuses, 30000)
    
    return () => {
      clearInterval(intervalId)
    }
  }, [])

  const setActiveChannel = (channelId: string) => {
    const channel = channels.find(c => c.id === channelId)
    if (channel) {
      setActiveChannelState(channel)
      setIsDirectMessageActive(false)
      markChannelAsRead(channelId)
    }
  }

  const toggleMessagePin = async (messageId: string) => {
    if (!activeChannel) return
    const target = messages.find(m => m.id === messageId)
    if (!target) return
    const pinned = !target.pinnedAt

    try {
      const result = await channelsApi.setMessagePinned(activeChannel.id, messageId, pinned)
      patchMessage(messageId, { pinnedAt: result.pinnedAt })
    } catch (err) {
      setError('Failed to update pin')
    }
  }

  const sendChannelMessage = async (content: string) => {
    if (!activeChannel || !content.trim() || isDirectMessageActive) return

    try {
      const created = await channelsApi.sendMessage(activeChannel.id, content)
      setMessages(prev => [...prev, normalizeMessage(created)])
    } catch (err) {
      setError('Failed to send message')
    }
  }

  // Update a message in both the channel list and the open thread
  const patchMessage = (messageId: string, patch: Partial<Message>) => {
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, ...patch } : m))
    setThreadReplies(prev => prev.map(m => m.id === messageId ? { ...m, ...patch } : m))
    setThreadParent(prev => prev && prev.id === messageId ? { ...prev, ...patch } : prev)
  }

  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!activeChannel) return
    try {
      const result = await channelsApi.toggleReaction(activeChannel.id, messageId, emoji)
      patchMessage(messageId, { reactions: result.reactions })
    } catch (err) {
      setError('Failed to update reaction')
    }
  }

  const createTaskFromMessage = async (messageId: string) => {
    if (!activeChannel) return
    try {
      const result = await channelsApi.createTaskFromMessage(activeChannel.id, messageId)
      patchMessage(messageId, { taskId: result.taskId })
      toast.success(`Task created: ${result.title}`)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create task')
    }
  }

  const openThread = async (messageId: string) => {
    if (!activeChannel) return
    const parent = messages.find(m => m.id === messageId)
    if (!parent) return
    setThreadParent(parent)
    try {
      const replies = await channelsApi.getReplies(activeChannel.id, messageId)
      setThreadReplies(replies.map(normalizeMessage))
    } catch (err) {
      setThreadReplies([])
      setError('Failed to load replies')
    }
  }

  const closeThread = () => {
    setThreadParent(null)
    setThreadReplies([])
  }

  const sendThreadReply = async (content: string) => {
    if (!activeChannel || !threadParent || !content.trim()) return
    try {
      const created = await channelsApi.sendReply(activeChannel.id, threadParent.id, content)
      setThreadReplies(prev => [...prev, normalizeMessage(created)])
      patchMessage(threadParent.id, { replyCount: (threadParent.replyCount ?? 0) + 1 })
    } catch (err) {
      setError('Failed to send reply')
    }
  }

  const markChannelAsRead = (channelId: string) => {
    setChannels(prevChannels =>
      prevChannels.map(channel =>
        channel.id === channelId
          ? { ...channel, unreadCount: 0 }
          : channel
      )
    )
  }

  const createChannel = async (channelData: {
    name: string
    teamId: string
    description?: string
    isPrivate?: boolean
    type?: number
  }) => {
    try {
      setIsLoading(true)
      const newChannel = await channelsApi.createChannel(channelData)

      setChannels(prev => [...prev, newChannel])
      setActiveChannelState(newChannel)
      setIsDirectMessageActive(false)

      return newChannel
    } catch (err) {
      setError('Failed to create channel')
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const setActiveDirectContact = (userId: string) => {
    const contact = directContacts.find(c => c.id === userId)
    if (contact) {
      setActiveDirectContactState(contact)
      setIsDirectMessageActive(true)
    }
  }

  const sendDirectMessage = async (content: string) => {
    if (!activeDirectContact || !content.trim() || !isDirectMessageActive) return

    try {
      const created = await directMessagesApi.sendMessage(activeDirectContact.id, content)
      setDirectMessages(prev => [...prev, normalizeDirectMessage(created)])
    } catch (err) {
      setError('Failed to send direct message')
    }
  }

  const markDirectMessageAsRead = async (messageId: string) => {
    try {
      setDirectMessages(prevMessages =>
        prevMessages.map(message =>
          message.id === messageId
            ? { ...message, readAt: new Date() }
            : message
        )
      )

      await directMessagesApi.markAsRead(messageId)
    } catch (err) {
    }
  }

  const markAllDirectMessagesAsRead = async () => {
    if (!activeDirectContact) return

    try {
      setDirectMessages(prevMessages =>
        prevMessages.map(message =>
          message.senderId === activeDirectContact.id && !message.readAt
            ? { ...message, readAt: new Date() }
            : message
        )
      )

      await directMessagesApi.markAllAsRead(activeDirectContact.id)

      setDirectContacts(prevContacts =>
        prevContacts.map(contact =>
          contact.id === activeDirectContact.id
            ? { ...contact, unreadCount: 0 }
            : contact
        )
      )
    } catch (err) {
    }
  }

  const canCreateChannels = async (teamId: string) => {
    try {
      return await channelsApi.canCreateChannel(teamId)
    } catch (error) {
      return { canCreate: false, reason: 'Failed to check permissions' }
    }
  }

  return (
    <MessagesContext.Provider
      value={{
        channels,
        activeChannel,
        messages,
        setActiveChannel,
        sendChannelMessage,
        toggleMessagePin,
        toggleReaction,
        createTaskFromMessage,
        threadParent,
        threadReplies,
        openThread,
        closeThread,
        sendThreadReply,
        currentUserId: currentUser?.id,
        markChannelAsRead,
        createChannel,
        canCreateChannels,

        directContacts,
        activeDirectContact,
        directMessages,
        setActiveDirectContact,
        sendDirectMessage,
        markDirectMessageAsRead,
        markAllDirectMessagesAsRead,

        isLoading,
        error,
        isDirectMessageActive,
        setIsDirectMessageActive
      }}
    >
      {children}
    </MessagesContext.Provider>
  )
}