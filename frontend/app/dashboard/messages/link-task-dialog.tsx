"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { taskReferencesApi, tasksApi } from "@/lib/api"
import { useMessages } from "./messagesContext"

interface LinkTaskDialogProps {
  messageId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Link a channel message to an existing task
export function LinkTaskDialog({ messageId, open, onOpenChange }: LinkTaskDialogProps) {
  const { activeChannel } = useMessages()
  const [tasks, setTasks] = useState<{ id: string; title: string }[]>([])
  const [taskId, setTaskId] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setTaskId("")
    tasksApi.getAllTasks().then((all: any[]) => setTasks(all.map((t) => ({ id: t.id, title: t.title })))).catch(() => {
      toast.error("Failed to load tasks")
    })
  }, [open])

  const link = async () => {
    if (!taskId) return
    setSaving(true)
    try {
      await taskReferencesApi.add(taskId, "message", messageId)
      toast.success("Message linked to task")
      onOpenChange(false)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to link message")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Link to a task</DialogTitle>
          <DialogDescription>
            Attach this message{activeChannel ? ` from #${activeChannel.name}` : ""} to an existing task so it's easy to find from the task.
          </DialogDescription>
        </DialogHeader>
        <Select value={taskId} onValueChange={setTaskId}>
          <SelectTrigger aria-label="Task"><SelectValue placeholder="Choose a task..." /></SelectTrigger>
          <SelectContent>
            {tasks.length === 0 && <div className="p-2 text-sm text-muted-foreground">No tasks yet</div>}
            {tasks.map((t) => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={link} disabled={!taskId || saving}>Link</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
