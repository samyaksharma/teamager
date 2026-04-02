'use client'

import { useRef, useEffect } from "react"
import { formatDistanceToNow } from "date-fns"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { PaperclipIcon, Send, Smile, AtSign } from "lucide-react"
import { useState } from "react"
import { useMessages } from "./messagesContext"

export default function DirectMessageView() {
  const { 
    activeDirectContact, 
    directMessages, 
    sendDirectMessage,
    isLoading
  } = useMessages()
  
  const [messageInput, setMessageInput] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [directMessages])
  
  // Handle sending a message
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (messageInput.trim()) {
      sendDirectMessage(messageInput)
      setMessageInput("")
    }
  }
  
  if (!activeDirectContact) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Select a contact</h2>
          <p className="text-muted-foreground">Choose someone to start a conversation</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="flex flex-col h-full">
      {/* Contact Header */}
      <header className="flex h-14 items-center justify-between border-b bg-white px-4 dark:bg-gray-950">
        <div className="flex items-center gap-2">
          <Avatar>
            <AvatarImage src={activeDirectContact.avatar || "/placeholder-user.jpg"} alt={activeDirectContact.name} />
            <AvatarFallback>{activeDirectContact.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="font-semibold">{activeDirectContact.name}</h1>
            <div className="flex items-center gap-1">
              <div className={`h-2 w-2 rounded-full ${
                activeDirectContact.status === 'online' ? 'bg-green-500' : 'bg-gray-300'
              }`}></div>
              <span className="text-xs text-muted-foreground">
                {activeDirectContact.status === 'online' ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-6">
          {directMessages.length > 0 ? (
            directMessages.map((message) => {
              const isCurrentUser = message.senderId !== activeDirectContact.id
              return (
                <div key={message.id} className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex gap-3 max-w-[80%] ${isCurrentUser ? 'flex-row-reverse' : ''}`}>
                    {!isCurrentUser && (
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={activeDirectContact.avatar || "/placeholder-user.jpg"} alt={activeDirectContact.name} />
                        <AvatarFallback>{activeDirectContact.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                    )}
                    <div className={`${isCurrentUser ? 'bg-primary text-primary-foreground' : 'bg-muted'} rounded-lg p-3`}>
                      <div className="break-words">
                        <p>{message.content}</p>
                      </div>
                      <div className="mt-1 flex items-center justify-end gap-1">
                        <span className="text-xs opacity-70">
                          {formatDistanceToNow(new Date(message.timestamp), { addSuffix: true })}
                        </span>
                        {isCurrentUser && message.readAt && (
                          <Badge variant="outline" className="h-4 px-1 text-[10px]">Read</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          ) : (
            <div className="text-center text-gray-500 py-10">
              {isLoading ? 'Loading messages...' : 'No messages yet. Start the conversation!'}
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
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8">
                      <PaperclipIcon className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Attach file</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8">
                      <AtSign className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Mention</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8">
                      <Smile className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Emoji</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
          <Separator />
          <div className="flex items-center p-3">
            <Input
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              placeholder={`Message ${activeDirectContact.name}`}
              className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            <Button type="submit" size="icon" className="ml-2 rounded-full">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}