"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { formatDistanceToNow } from "date-fns"
import { CheckSquare, Link2, MessageSquare, Pin, Smile } from "lucide-react"
import Link from "next/link"
import { useMessages, type Message } from "./messagesContext"
import { LinkTaskDialog } from "./link-task-dialog"

// Message text with @mentions of real teammates highlighted
function MessageText({ message, currentUserId }: { message: Message; currentUserId?: string }) {
  const byUsername = new Map((message.mentions ?? []).map((m) => [m.username.toLowerCase(), m]))
  const parts = message.content.split(/((?<![\w@])@[A-Za-z0-9_]+(?:[.-][A-Za-z0-9_]+)*)/g)
  return (
    <p className="mt-1 whitespace-pre-wrap break-words">
      {parts.map((part, i) => {
        const mention = part.startsWith("@") ? byUsername.get(part.slice(1).toLowerCase()) : undefined
        if (!mention) return <span key={i}>{part}</span>
        const isMe = mention.userId === currentUserId
        return (
          <span
            key={i}
            title={mention.name}
            className={`rounded px-1 font-medium ${isMe ? "bg-yellow-200 text-yellow-900 dark:bg-yellow-500/30 dark:text-yellow-100" : "bg-primary/10 text-primary"}`}
          >
            {part}
          </span>
        )
      })}
    </p>
  )
}

const QUICK_EMOJIS = ["👍", "❤️", "😂", "🎉", "👀", "🙏"]

interface MessageItemProps {
  message: Message
  // Thread replies can't be threaded, pinned or turned into tasks
  inThread?: boolean
}

export function MessageItem({ message, inThread = false }: MessageItemProps) {
  const { toggleMessagePin, toggleReaction, createTaskFromMessage, openThread, currentUserId } = useMessages()
  const [linkOpen, setLinkOpen] = useState(false)

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
        <MessageText message={message} currentUserId={currentUserId} />
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
          {(message.linkedTasks ?? []).map((t) => (
            <Link key={t.id} href="/dashboard/tasks" className="inline-flex max-w-[14rem] items-center gap-1 rounded-full border px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted" title={`Linked task: ${t.title}`}>
              <CheckSquare className="h-3 w-3 shrink-0" />
              <span className="truncate">{t.title}</span>
            </Link>
          ))}
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
              <Button
                variant="ghost"
                size="sm"
                className="h-7 rounded-full px-3 text-xs"
                onClick={() => setLinkOpen(true)}
              >
                <Link2 className="mr-1 h-3 w-3" />
                Link task
              </Button>
              <LinkTaskDialog messageId={message.id} open={linkOpen} onOpenChange={setLinkOpen} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
