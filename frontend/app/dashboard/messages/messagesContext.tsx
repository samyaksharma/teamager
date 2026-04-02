'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { useSocket } from '@/lib/socketContext'
import { channelsApi, directMessagesApi } from '@/lib/api'
import { useAuth } from '@/lib/authContext'

interface User {
  id: string
  name: string
  username?: string
  avatar?: string
  status?: 'online' | 'offline' | 'away'
}

interface Message {
  id: string
  sender: {
    id: string
    name: string
    avatar?: string
  }
  content: string
  timestamp: Date
  channelId: string
}

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
  // Channel state
  channels: Channel[]
  activeChannel: Channel | null
  messages: Message[]
  setActiveChannel: (channelId: string) => void
  sendChannelMessage: (content: string) => Promise<void>
  markChannelAsRead: (channelId: string) => void
  createChannel: (channelData: { name: string, teamId: string, description?: string, isPrivate?: boolean, type?: number }) => Promise<void>
  canCreateChannels: (teamId: string) => Promise<{ canCreate: boolean, reason?: string }>

  // Direct message state
  directContacts: User[]
  activeDirectContact: User | null
  directMessages: DirectMessage[]
  setActiveDirectContact: (userId: string) => void
  sendDirectMessage: (content: string) => Promise<void>
  markDirectMessageAsRead: (messageId: string) => Promise<void>
  markAllDirectMessagesAsRead: () => Promise<void>

  // Shared state
  isLoading: boolean
  error: string | null
  isDirectMessageActive: boolean
  setIsDirectMessageActive: (value: boolean) => void
}

const MessagesContext = createContext<MessagesContextType>({
  // Channel state
  channels: [],
  activeChannel: null,
  messages: [],
  setActiveChannel: () => {},
  sendChannelMessage: async () => {},
  markChannelAsRead: () => {},
  createChannel: async () => {},
  canCreateChannels: async () => ({ canCreate: false }),

  // Direct message state
  directContacts: [],
  activeDirectContact: null,
  directMessages: [],
  setActiveDirectContact: () => {},
  sendDirectMessage: async () => {},
  markDirectMessageAsRead: async () => {},
  markAllDirectMessagesAsRead: async () => {},

  // Shared state
  isLoading: false,
  error: null,
  isDirectMessageActive: false,
  setIsDirectMessageActive: () => {}
})

export const useMessages = () => useContext(MessagesContext)

export const MessagesProvider = ({ children }: { children: React.ReactNode }) => {
  const { socket, isConnected, joinRoom } = useSocket()
  const { user: authUser, teams } = useAuth()

  // Shared state
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [isDirectMessageActive, setIsDirectMessageActive] = useState<boolean>(false)

  // Channel state
  const [channels, setChannels] = useState<Channel[]>([])
  const [activeChannel, setActiveChannelState] = useState<Channel | null>(null)
  const [messages, setMessages] = useState<Message[]>([])

  // Direct message state
  const [directContacts, setDirectContacts] = useState<User[]>([])
  const [activeDirectContact, setActiveDirectContactState] = useState<User | null>(null)
  const [directMessages, setDirectMessages] = useState<DirectMessage[]>([])

  // Current user from auth context
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

  // Load channels for all teams user is part of
  useEffect(() => {
    const fetchChannels = async () => {
      setIsLoading(true)
      try {
        let allChannels: Channel[] = []
        
        // Fetch channels for all teams
        for (const team of teams) {
          try {
            const teamChannels = await channelsApi.getAllChannels(team.id)
            allChannels = [...allChannels, ...teamChannels]
          } catch (err) {
          }
        }
        
        setChannels(allChannels)

        // Set default channel as active if none is selected
        if (allChannels.length > 0 && !activeChannel) {
          const defaultChannel = allChannels.find(c => c.isDefault) || allChannels[0]
          setActiveChannelState(defaultChannel)
        }
      } catch (err) {
        setError('Failed to load channels')

        // No fallback data - show empty state instead
        setChannels([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchChannels()
  }, [teams])

  // Load direct message contacts
  useEffect(() => {
    const fetchContacts = async () => {
      try {
        // Get this from API when available - for now show empty state
        setDirectContacts([])
      } catch (err) {
      }
    }

    fetchContacts()
  }, [])

  // Load channel messages when active channel changes
  useEffect(() => {
    if (!activeChannel || isDirectMessageActive) return

    const fetchMessages = async () => {
      setIsLoading(true)
      try {
        // Join the socket.io room for this channel
        joinRoom(activeChannel.id)

        // Fetch messages from API
        const response = await channelsApi.getMessages(activeChannel.id)
        setMessages(response)

        // Mark channel as read
        markChannelAsRead(activeChannel.id)
      } catch (err) {
        setError('Failed to load messages')

        // No fallback data - show empty state instead
        setMessages([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchMessages()
  }, [activeChannel, isDirectMessageActive, joinRoom])

  // Load direct messages when active contact changes
  useEffect(() => {
    if (!activeDirectContact || !isDirectMessageActive) return

    const fetchDirectMessages = async () => {
      setIsLoading(true)
      try {
        const response = await directMessagesApi.getMessagesWithUser(activeDirectContact.id)
        setDirectMessages(response)

        // Mark all messages as read
        await markAllDirectMessagesAsRead()
      } catch (err) {
        setError('Failed to load direct messages')

        // Fallback to sample data
        setDirectMessages([
          {
            id: 'dm1',
            senderId: 'user2',
            receiverId: currentUser.id,
            content: 'Hey, how are you doing?',
            timestamp: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
            sender: {
              id: 'user2',
              name: 'Mike Thompson',
              avatar: '/placeholder-user.jpg'
            }
          },
          {
            id: 'dm2',
            senderId: currentUser.id,
            receiverId: 'user2',
            content: 'Doing well, thanks! Working on the new feature.',
            timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
            sender: {
              id: currentUser.id,
              name: currentUser.name
            }
          }
        ])
      } finally {
        setIsLoading(false)
      }
    }

    fetchDirectMessages()
  }, [activeDirectContact, isDirectMessageActive, currentUser.id])

  // Poll for new channel messages instead of using WebSockets
  useEffect(() => {
    if (!activeChannel || isDirectMessageActive) return
    
    let lastMessageTimestamp = messages.length > 0 
      ? Math.max(...messages.map(msg => new Date(msg.timestamp).getTime()))
      : 0;
    
    // Function to fetch new messages
    const fetchNewMessages = async () => {
      try {
        // Get messages after the last one we have
        const newMessages = await channelsApi.getMessages(
          activeChannel.id, 
          { after: new Date(lastMessageTimestamp) }
        );
        
        if (newMessages.length > 0) {
          // Update messages
          setMessages(prev => [...prev, ...newMessages]);
          
          // Update latest timestamp
          lastMessageTimestamp = Math.max(...newMessages.map(msg => 
            new Date(msg.timestamp).getTime()
          ));
        }
      } catch (err) {
      }
    };
    
    // Initial fetch
    fetchNewMessages();
    
    // Set up polling interval (every 3 seconds)
    const intervalId = setInterval(fetchNewMessages, 3000);
    
    return () => {
      clearInterval(intervalId);
    };
  }, [activeChannel, isDirectMessageActive, messages])

  // Poll for new direct messages instead of using WebSockets
  useEffect(() => {
    if (!isDirectMessageActive || !activeDirectContact) return
    
    let lastMessageTimestamp = directMessages.length > 0 
      ? Math.max(...directMessages.map(msg => new Date(msg.timestamp).getTime()))
      : 0;
    
    // Function to fetch new direct messages
    const fetchNewDirectMessages = async () => {
      try {
        // Get messages after the last one we have
        const newMessages = await directMessagesApi.getMessagesBetweenUsers(
          activeDirectContact.id,
          { after: new Date(lastMessageTimestamp) }
        );
        
        if (newMessages.length > 0) {
          // Update messages
          setDirectMessages(prev => [...prev, ...newMessages]);
          
          // Update latest timestamp
          lastMessageTimestamp = Math.max(...newMessages.map(msg => 
            new Date(msg.timestamp).getTime()
          ));
          
          // Mark new messages as read
          for (const message of newMessages) {
            if (message.senderId === activeDirectContact.id && !message.readAt) {
              directMessagesApi.markAsRead(message.id);
            }
          }
        }
      } catch (err) {
      }
    };
    
    // Initial fetch
    fetchNewDirectMessages();
    
    // Set up polling interval (every 3 seconds)
    const intervalId = setInterval(fetchNewDirectMessages, 3000);
    
    return () => {
      clearInterval(intervalId);
    };
  }, [activeDirectContact, isDirectMessageActive, directMessages])

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
            // 10% chance to toggle status
            if (Math.random() > 0.9) {
              const newStatus = contact.status === 'online' ? 'offline' : 'online'
              return { ...contact, status: newStatus }
            }
            return contact
          })
        })
      }
    }
    
    // Set up polling interval (every 30 seconds)
    const intervalId = setInterval(updateUserStatuses, 30000)
    
    return () => {
      clearInterval(intervalId)
    }
  }, [])

  // Channel functions
  const setActiveChannel = (channelId: string) => {
    const channel = channels.find(c => c.id === channelId)
    if (channel) {
      setActiveChannelState(channel)
      setIsDirectMessageActive(false)
      markChannelAsRead(channelId)
    }
  }

  const sendChannelMessage = async (content: string) => {
    if (!activeChannel || !content.trim() || isDirectMessageActive) return

    try {
      // First, add the message locally for immediate feedback
      const newMessage: Message = {
        id: `msg-${Date.now()}`,
        sender: {
          id: currentUser.id,
          name: currentUser.name,
          avatar: currentUser.avatar
        },
        content,
        timestamp: new Date(),
        channelId: activeChannel.id
      }

      setMessages(prev => [...prev, newMessage])

      // Send via API
      await channelsApi.sendMessage(activeChannel.id, content)

    } catch (err) {
      setError('Failed to send message')
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

  // Direct message functions
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
      // First, add the message locally for immediate feedback
      const newMessage: DirectMessage = {
        id: `dm-${Date.now()}`,
        senderId: currentUser.id,
        receiverId: activeDirectContact.id,
        content,
        timestamp: new Date(),
        sender: {
          id: currentUser.id,
          name: currentUser.name,
          avatar: currentUser.avatar
        },
        receiver: activeDirectContact
      }

      setDirectMessages(prev => [...prev, newMessage])

      // Send via API
      await directMessagesApi.sendMessage(activeDirectContact.id, content)

    } catch (err) {
      setError('Failed to send direct message')
    }
  }

  const markDirectMessageAsRead = async (messageId: string) => {
    try {
      // Update locally
      setDirectMessages(prevMessages =>
        prevMessages.map(message =>
          message.id === messageId
            ? { ...message, readAt: new Date() }
            : message
        )
      )

      // Update via API
      await directMessagesApi.markAsRead(messageId)
    } catch (err) {
    }
  }

  const markAllDirectMessagesAsRead = async () => {
    if (!activeDirectContact) return

    try {
      // Update locally
      setDirectMessages(prevMessages =>
        prevMessages.map(message =>
          message.senderId === activeDirectContact.id && !message.readAt
            ? { ...message, readAt: new Date() }
            : message
        )
      )

      // Update via API
      await directMessagesApi.markAllAsRead(activeDirectContact.id)

      // Update unread count in contacts
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
        directMessages,
        setActiveDirectContact,
        sendDirectMessage,
        markDirectMessageAsRead,
        markAllDirectMessagesAsRead,

        // Shared state
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