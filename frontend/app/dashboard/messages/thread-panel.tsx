"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Send, X } from "lucide-react"
import { useMessages } from "./messagesContext"
import { MessageItem } from "./message-item"
import { MentionInput } from "@/components/mention-input"

export function ThreadPanel() {
  const { threadParent, threadReplies, closeThread, sendThreadReply, directContacts } = useMessages()
  const [reply, setReply] = useState("")

  if (!threadParent) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!reply.trim()) return
    sendThreadReply(reply)
    setReply("")
  }

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l">
      <header className="flex h-14 items-center justify-between border-b px-4">
        <h3 className="font-semibold">Thread</h3>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={closeThread} aria-label="Close thread">
          <X className="h-4 w-4" />
        </Button>
      </header>
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          <MessageItem message={threadParent} inThread />
          <div className="border-t pt-4 text-xs text-muted-foreground">
            {threadReplies.length} {threadReplies.length === 1 ? "reply" : "replies"}
          </div>
          {threadReplies.map((r) => (
            <MessageItem key={r.id} message={r} inThread />
          ))}
        </div>
      </ScrollArea>
      <form onSubmit={handleSubmit} className="flex items-center border-t p-3">
        <MentionInput value={reply} onChange={setReply} people={directContacts} placeholder="Reply..." />
        <Button type="submit" size="icon" className="ml-2 rounded-full" aria-label="Send reply">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </aside>
  )
}
