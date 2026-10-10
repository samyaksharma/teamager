"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { CheckSquare, Plus, X } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { taskReferencesApi, tasksApi } from "@/lib/api"
import { EnumLabels } from "@/lib/enums"

interface DocumentTasksProps {
  documentId: string
  // Linking needs write access to the task, which the API enforces; this only hides the picker for read-only viewers
  canLink: boolean
}

// Tasks that point at this document, and a picker to link another task to it
export function DocumentTasks({ documentId, canLink }: DocumentTasksProps) {
  const [open, setOpen] = useState(false)
  const [linked, setLinked] = useState<{ refId: string; id: string; title: string; status: number }[]>([])
  const [choices, setChoices] = useState<{ id: string; title: string }[]>([])
  const [taskId, setTaskId] = useState("")

  const load = useCallback(async () => {
    try {
      setLinked(await taskReferencesApi.forDocument(documentId))
    } catch {
      toast.error("Failed to load linked tasks")
    }
  }, [documentId])

  useEffect(() => {
    if (!open) return
    load()
    if (canLink) {
      tasksApi.getAllTasks().then((all: any[]) => setChoices(all.map((t) => ({ id: t.id, title: t.title })))).catch(() => {})
    }
  }, [open, load, canLink])

  const link = async () => {
    if (!taskId) return
    try {
      await taskReferencesApi.add(taskId, "document", documentId)
      setTaskId("")
      await load()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to link task")
    }
  }

  const unlink = async (item: { refId: string; id: string }) => {
    try {
      await taskReferencesApi.remove(item.id, item.refId)
      setLinked((prev) => prev.filter((l) => l.refId !== item.refId))
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to remove link")
    }
  }

  const available = choices.filter((c) => !linked.some((l) => l.id === c.id))

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <CheckSquare className="mr-2 h-4 w-4" />
          Tasks
        </Button>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b p-4">
          <SheetTitle>Linked tasks</SheetTitle>
          <SheetDescription>Tasks that reference this page.</SheetDescription>
        </SheetHeader>
        {canLink && (
          <div className="flex gap-2 border-b p-4">
            <Select value={taskId} onValueChange={setTaskId}>
              <SelectTrigger aria-label="Task to link"><SelectValue placeholder="Link a task..." /></SelectTrigger>
              <SelectContent>
                {available.length === 0 && <div className="p-2 text-sm text-muted-foreground">No tasks to link</div>}
                {available.map((t) => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="icon" variant="outline" onClick={link} disabled={!taskId} aria-label="Link task"><Plus className="h-4 w-4" /></Button>
          </div>
        )}
        <ul className="flex-1 overflow-y-auto">
          {linked.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">No tasks are linked to this page yet.</li>}
          {linked.map((t) => (
            <li key={t.refId} className="group flex items-center gap-2 border-b px-4 py-3">
              <Link href="/dashboard/tasks" className="min-w-0 flex-1 truncate text-sm font-medium hover:underline">{t.title}</Link>
              <Badge variant="outline">{EnumLabels.TaskStatus[t.status as keyof typeof EnumLabels.TaskStatus] ?? "Unknown"}</Badge>
              {canLink && (
                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 focus:opacity-100" onClick={() => unlink(t)} aria-label={`Unlink ${t.title}`}>
                  <X className="h-3 w-3" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      </SheetContent>
    </Sheet>
  )
}
