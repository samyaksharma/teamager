'use client'

import React, { createContext, useContext, useState, useCallback } from 'react'
import { channelsApi, directMessagesApi, tasksApi } from './api'

interface SocketContextType {
  isConnected: boolean
  joinRoom: (roomId: string) => void
  sendMessage: (roomId: string, message: string, sender: any) => Promise<void>
  updateTask: (roomId: string, taskId: string, changes: any) => Promise<void>
}

const SocketContext = createContext<SocketContextType>({
  isConnected: true, // Always "connected" since we're using polling
  joinRoom: () => {},
  sendMessage: async () => {},
  updateTask: async () => {}
})

export const useSocket = () => useContext(SocketContext)

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  // Keep track of joined rooms (for real-time context)
  const [joinedRooms, setJoinedRooms] = useState<Set<string>>(new Set())
  
  // Join a room (team, document, or chat channel)
  // This is now just for bookkeeping since we don't have actual WebSocket rooms
  const joinRoom = useCallback((roomId: string) => {
    console.log(`Adding room to context: ${roomId}`)
    setJoinedRooms(prev => {
      const updated = new Set(prev)
      updated.add(roomId)
      return updated
    })
  }, [])

  // Send message to a channel using the API instead of WebSockets
  const sendMessage = useCallback(async (roomId: string, message: string, sender: any) => {
    try {
      // Check if this is a direct message or channel
      if (roomId.startsWith('user:')) {
        // Extract userId from the room ID (e.g., 'user:123' -> '123')
        const receiverId = roomId.split(':')[1]
        await directMessagesApi.sendMessage(receiverId, message)
      } else {
        // Regular channel message
        await channelsApi.sendMessage(roomId, message)
      }
    } catch (error) {
      console.error('Error sending message:', error)
    }
  }, [])

  // Update task using the API instead of WebSockets
  const updateTask = useCallback(async (roomId: string, taskId: string, changes: any) => {
    try {
      await tasksApi.updateTask(taskId, changes)
    } catch (error) {
      console.error('Error updating task:', error)
    }
  }, [])

  return (
    <SocketContext.Provider
      value={{
        isConnected: true, // Always "connected" since we're using polling
        joinRoom,
        sendMessage,
        updateTask
      }}
    >
      {children}
    </SocketContext.Provider>
  )
}