"use client"

import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { formatDistanceToNow } from "date-fns"
import { CheckSquare, MessageSquare, Pin, Smile } from "lucide-react"
import { useMessages, type Message } from "./messagesContext"

const QUICK_EMOJIS = ["👍", "❤️", "😂", "🎉", "👀", "🙏"]

interface MessageItemProps {
  message: Message
  // Thread replies can't be threaded, pinned or turned into tasks
  inThread?: boolean
}

export function MessageItem({ message, inThread = false }: MessageItemProps) {
  const { toggleMessagePin, toggleReaction, createTaskFromMessage, openThread, currentUserId } = useMessages()

  return (
    <div className="flex gap-3">
      <Avatar>
        <AvatarImage src={message.sender.avatar || "/placeholder-user.jpg"} alt={message.sender.name} />
        <AvatarFallback>{message.sender.name[0]}</AvatarFallback>
      </Avatar>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold">{message.sender.name}</span>
          <span className="text-xs text-gray-500">
            {formatDistanceToNow(message.timestamp, { addSuffix: true })}
          </span>
        </div>
        <p className="mt-1 whitespace-pre-wrap break-words">{message.content}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {(message.reactions ?? []).map((reaction) => {
            const mine = !!currentUserId && reaction.userIds.includes(currentUserId)
            return (
              <Button
                key={reaction.emoji}
                variant={mine ? "secondary" : "outline"}
                size="sm"
                className="h-7 rounded-full px-3 text-xs"
                onClick={() => toggleReaction(message.id, reaction.emoji)}
              >
                {reaction.emoji} {reaction.count}
              </Button>
            )
          })}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 rounded-full p-0" aria-label="Add reaction">
                <Smile className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="flex w-auto gap-1 p-2">
              {QUICK_EMOJIS.map((emoji) => (
                <Button
                  key={emoji}
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-base"
                  onClick={() => toggleReaction(message.id, emoji)}
                >
                  {emoji}
                </Button>
              ))}
            </PopoverContent>
          </Popover>
          {!inThread && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 rounded-full px-3 text-xs"
                onClick={() => openThread(message.id)}
              >
                <MessageSquare className="mr-1 h-3 w-3" />
                {message.replyCount ? `${message.replyCount} ${message.replyCount === 1 ? "reply" : "replies"}` : "Reply"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 rounded-full px-3 text-xs"
                onClick={() => toggleMessagePin(message.id)}
              >
                <Pin className={`mr-1 h-3 w-3 ${message.pinnedAt ? "fill-current" : ""}`} />
                {message.pinnedAt ? "Unpin" : "Pin"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 rounded-full px-3 text-xs"
                disabled={!!message.taskId}
                onClick={() => createTaskFromMessage(message.id)}
              >
                <CheckSquare className="mr-1 h-3 w-3" />
                {message.taskId ? "Task created" : "Create task"}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
