"use client"

import { useMemo, useRef, useState } from "react"
import { Calendar, Edit, Flag, MoreHorizontal, Trash2 } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TaskProgress } from "@/components/task-items"
import { EnumLabels, TaskPriority, TaskStatus } from "@/lib/enums"

export interface BoardTask {
  id: string
  title: string
  description?: string
  status: number
  priority: number
  dueDate?: string | Date | null
  assignee?: { id: string; name: string; avatarUrl?: string } | null
  teams?: { id: string; name: string }[]
  organization?: { id?: string; name: string } | null
  subtaskTotal?: number
  subtaskDone?: number
  checklistTotal?: number
  checklistDone?: number
}

interface Member {
  id: string
  name: string
}

interface TaskBoardProps {
  tasks: BoardTask[]
  currentUserId?: string
  members: Member[]
  onEdit: (task: BoardTask) => void
  onStatus: (taskId: string, status: number) => Promise<void> | void
  onPriority: (taskId: string, priority: number) => Promise<void> | void
  onAssign: (taskId: string, userId: string | null) => Promise<void> | void
  onDelete: (taskId: string) => Promise<void> | void
  // Move `taskIds` into `status` in this order (dropping a card)
  onReorder: (status: number, taskIds: string[]) => Promise<void> | void
}

const COLUMNS: { status: number; dot: string }[] = [
  { status: TaskStatus.BACKLOG, dot: "bg-gray-400" },
  { status: TaskStatus.TODO, dot: "bg-blue-400" },
  { status: TaskStatus.IN_PROGRESS, dot: "bg-yellow-400" },
  { status: TaskStatus.IN_REVIEW, dot: "bg-purple-400" },
  { status: TaskStatus.DONE, dot: "bg-green-400" },
]
const CANCELLED = { status: TaskStatus.CANCELLED, dot: "bg-red-300" }

const PRIORITY_COLORS: Record<number, string> = {
  [TaskPriority.LOW]: "text-blue-500",
  [TaskPriority.MEDIUM]: "text-yellow-500",
  [TaskPriority.HIGH]: "text-red-500",
  [TaskPriority.CRITICAL]: "text-red-700",
}

const statusLabel = (s: number) => EnumLabels.TaskStatus[s as keyof typeof EnumLabels.TaskStatus] ?? "Unknown"
const priorityLabel = (p: number) => EnumLabels.TaskPriority[p as keyof typeof EnumLabels.TaskPriority] ?? "Low"

export function TaskBoard({ tasks, currentUserId, members, onEdit, onStatus, onPriority, onAssign, onDelete, onReorder }: TaskBoardProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [dragging, setDragging] = useState<string | null>(null)
  const [overColumn, setOverColumn] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const columnRefs = useRef<Record<number, HTMLDivElement | null>>({})

  const hasCancelled = tasks.some((t) => t.status === TaskStatus.CANCELLED)
  const columns = hasCancelled ? [...COLUMNS, CANCELLED] : COLUMNS

  const byStatus = useMemo(() => {
    const map = new Map<number, BoardTask[]>()
    for (const c of [...COLUMNS, CANCELLED]) map.set(c.status, [])
    for (const t of tasks) map.get(t.status)?.push(t)
    return map
  }, [tasks])

  const taskIdsInView = useMemo(() => new Set(tasks.map((t) => t.id)), [tasks])
  // Selection only counts tasks that are still on the board (a filter may have hidden some)
  const selectedIds = useMemo(() => [...selected].filter((id) => taskIdsInView.has(id)), [selected, taskIdsInView])

  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })

  const bulk = async (action: (id: string) => Promise<void> | void) => {
    setBusy(true)
    try {
      await Promise.all(selectedIds.map((id) => action(id)))
    } finally {
      setBusy(false)
    }
  }

  const bulkDelete = async () => {
    if (!window.confirm(`Delete ${selectedIds.length} task${selectedIds.length === 1 ? "" : "s"}? This can't be undone.`)) return
    await bulk(onDelete)
    setSelected(new Set())
  }

  // Index to insert at, from the pointer position relative to the cards in the column
  const dropIndex = (status: number, clientY: number, draggedId: string) => {
    const container = columnRefs.current[status]
    if (!container) return 0
    const cards = Array.from(container.querySelectorAll<HTMLElement>("[data-task-id]")).filter(
      (el) => el.dataset.taskId !== draggedId
    )
    let index = 0
    for (const el of cards) {
      const box = el.getBoundingClientRect()
      if (clientY > box.top + box.height / 2) index++
    }
    return index
  }

  const handleDrop = async (e: React.DragEvent, status: number) => {
    e.preventDefault()
    const id = e.dataTransfer.getData("text/plain") || dragging
    setDragging(null)
    setOverColumn(null)
    if (!id) return

    const ids = (byStatus.get(status) ?? []).map((t) => t.id).filter((tid) => tid !== id)
    ids.splice(dropIndex(status, e.clientY, id), 0, id)
    await onReorder(status, ids)
  }

  return (
    <div className="space-y-3">
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/50 p-2" role="toolbar" aria-label="Bulk actions">
          <span className="px-2 text-sm font-medium">{selectedIds.length} selected</span>
          <Select onValueChange={(v) => bulk((id) => onStatus(id, Number(v)))} disabled={busy}>
            <SelectTrigger className="h-8 w-40 text-xs" aria-label="Move selected to"><SelectValue placeholder="Move to..." /></SelectTrigger>
            <SelectContent>
              {[...COLUMNS, CANCELLED].map((c) => <SelectItem key={c.status} value={String(c.status)}>{statusLabel(c.status)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select onValueChange={(v) => bulk((id) => onPriority(id, Number(v)))} disabled={busy}>
            <SelectTrigger className="h-8 w-40 text-xs" aria-label="Set priority of selected"><SelectValue placeholder="Set priority..." /></SelectTrigger>
            <SelectContent>
              {[TaskPriority.LOW, TaskPriority.MEDIUM, TaskPriority.HIGH, TaskPriority.CRITICAL].map((p) => (
                <SelectItem key={p} value={String(p)}>{priorityLabel(p)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select onValueChange={(v) => bulk((id) => onAssign(id, v === "none" ? null : v))} disabled={busy}>
            <SelectTrigger className="h-8 w-44 text-xs" aria-label="Assign selected to"><SelectValue placeholder="Assign to..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Unassigned</SelectItem>
              {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}{m.id === currentUserId ? " (you)" : ""}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-8 text-red-600" onClick={bulkDelete} disabled={busy}>
            <Trash2 className="mr-1 h-3 w-3" /> Delete
          </Button>
          <Button variant="ghost" size="sm" className="ml-auto h-8" onClick={() => setSelected(new Set())}>Clear</Button>
        </div>
      )}

      <div className={`grid gap-4 md:h-[calc(100vh-260px)] ${columns.length > 5 ? "grid-cols-6" : "grid-cols-5"}`}>
        {columns.map((col) => {
          const colTasks = byStatus.get(col.status) ?? []
          const isOver = overColumn === col.status && dragging !== null
          return (
            <div
              key={col.status}
              className={`flex min-w-0 flex-col rounded-lg border p-2 transition-colors ${isOver ? "border-primary bg-primary/5" : "border-transparent bg-muted/30"}`}
              data-testid={`column-${statusLabel(col.status)}`}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (overColumn !== col.status) setOverColumn(col.status) }}
              onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverColumn(null) }}
              onDrop={(e) => handleDrop(e, col.status)}
            >
              <div className="mb-2 flex items-center gap-2 px-1">
                <div className={`h-2.5 w-2.5 rounded-full ${col.dot}`} />
                <h3 className="text-sm font-medium">{statusLabel(col.status)}</h3>
                <span className="text-xs text-muted-foreground" data-testid="column-count">{colTasks.length}</span>
              </div>
              <div ref={(el) => { columnRefs.current[col.status] = el }} className="flex-1 space-y-2 overflow-y-auto pr-1">
                {colTasks.map((task) => {
                  const isSelected = selected.has(task.id)
                  return (
                    <Card
                      key={task.id}
                      data-task-id={task.id}
                      draggable
                      onDragStart={(e) => { e.dataTransfer.setData("text/plain", task.id); e.dataTransfer.effectAllowed = "move"; setDragging(task.id) }}
                      onDragEnd={() => { setDragging(null); setOverColumn(null) }}
                      className={`cursor-grab shadow-sm active:cursor-grabbing ${dragging === task.id ? "opacity-50" : ""} ${isSelected ? "ring-2 ring-primary" : ""}`}
                    >
                      <CardContent className="space-y-2 p-3">
                        <div className="flex items-start gap-2">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(v) => toggle(task.id, v === true)}
                            aria-label={`Select ${task.title}`}
                            className="mt-1"
                          />
                          <h4 className="min-w-0 flex-1 break-words text-sm font-medium">{task.title}</h4>
                          <DropdownMenu modal={false}>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6" aria-label={`Actions for ${task.title}`}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => onEdit(task)}><Edit className="mr-2 h-3 w-3" />Edit task</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuLabel className="text-xs text-muted-foreground">Move to</DropdownMenuLabel>
                              {[...COLUMNS, CANCELLED].filter((c) => c.status !== task.status).map((c) => (
                                <DropdownMenuItem key={c.status} onClick={() => onStatus(task.id, c.status)}>{statusLabel(c.status)}</DropdownMenuItem>
                              ))}
                              <DropdownMenuSeparator />
                              <DropdownMenuLabel className="text-xs text-muted-foreground">Priority</DropdownMenuLabel>
                              {[TaskPriority.LOW, TaskPriority.MEDIUM, TaskPriority.HIGH, TaskPriority.CRITICAL].map((p) => (
                                <DropdownMenuItem key={p} onClick={() => onPriority(task.id, p)}>{priorityLabel(p)}</DropdownMenuItem>
                              ))}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => onAssign(task.id, currentUserId ?? null)}>Assign to me</DropdownMenuItem>
                              {members.filter((m) => m.id !== currentUserId).slice(0, 5).map((m) => (
                                <DropdownMenuItem key={m.id} onClick={() => onAssign(task.id, m.id)}>Assign to {m.name}</DropdownMenuItem>
                              ))}
                              <DropdownMenuItem onClick={() => onAssign(task.id, null)}>Unassign</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-red-600" onClick={() => onDelete(task.id)}>Delete</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        {task.description && <p className="line-clamp-2 text-xs text-muted-foreground">{task.description}</p>}

                        {task.teams && task.teams.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {task.teams.map((team) => (
                              <Badge key={team.id} variant="outline" className="border-blue-100 bg-blue-50 py-0 text-xs text-blue-700">{team.name}</Badge>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1" title={`${priorityLabel(task.priority)} priority`}>
                              <Flag className={`h-3 w-3 ${PRIORITY_COLORS[task.priority] ?? PRIORITY_COLORS[0]}`} />
                              {priorityLabel(task.priority)}
                            </span>
                            {task.dueDate && (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {new Date(task.dueDate).toLocaleDateString()}
                              </span>
                            )}
                            <TaskProgress task={task} />
                          </div>
                          {task.assignee && (
                            <Avatar className="h-6 w-6" title={task.assignee.name}>
                              <AvatarImage src={task.assignee.avatarUrl || "/placeholder-user.jpg"} alt={task.assignee.name} />
                              <AvatarFallback>{task.assignee.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
                {colTasks.length === 0 && (
                  <p className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
                    {isOver ? "Drop here" : "No tasks"}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
