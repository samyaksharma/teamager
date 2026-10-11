"use client"

import { useMemo, useState } from "react"
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { TaskProgress } from "@/components/task-items"
import type { BoardTask } from "@/components/task-board"
import { EnumLabels, TaskStatus } from "@/lib/enums"

const statusLabel = (s: number) => EnumLabels.TaskStatus[s as keyof typeof EnumLabels.TaskStatus] ?? "Unknown"
const priorityLabel = (p: number) => EnumLabels.TaskPriority[p as keyof typeof EnumLabels.TaskPriority] ?? "Low"
const isClosed = (t: BoardTask) => t.status === TaskStatus.DONE || t.status === TaskStatus.CANCELLED

const STATUS_BADGE: Record<number, string> = {
  [TaskStatus.BACKLOG]: "bg-gray-100 text-gray-800",
  [TaskStatus.TODO]: "bg-blue-100 text-blue-800",
  [TaskStatus.IN_PROGRESS]: "bg-yellow-100 text-yellow-800",
  [TaskStatus.IN_REVIEW]: "bg-purple-100 text-purple-800",
  [TaskStatus.DONE]: "bg-green-100 text-green-800",
  [TaskStatus.CANCELLED]: "bg-red-100 text-red-800",
}

interface ViewProps {
  tasks: BoardTask[]
  onEdit: (task: BoardTask) => void
}

type SortKey = "title" | "status" | "priority" | "assignee" | "dueDate"

export function TaskListView({ tasks, onEdit }: ViewProps) {
  const [sortKey, setSortKey] = useState<SortKey>("dueDate")
  const [ascending, setAscending] = useState(true)

  const sorted = useMemo(() => {
    const value = (t: BoardTask): string | number => {
      switch (sortKey) {
        case "title": return t.title.toLowerCase()
        case "status": return t.status
        case "priority": return t.priority
        case "assignee": return t.assignee?.name.toLowerCase() ?? "￿"
        default: return t.dueDate ? new Date(t.dueDate).getTime() : Number.MAX_SAFE_INTEGER
      }
    }
    return [...tasks].sort((a, b) => {
      const x = value(a), y = value(b)
      const cmp = x < y ? -1 : x > y ? 1 : 0
      return ascending ? cmp : -cmp
    })
  }, [tasks, sortKey, ascending])

  const header = (key: SortKey, label: string) => {
    const active = sortKey === key
    const Icon = !active ? ArrowUpDown : ascending ? ArrowUp : ArrowDown
    return (
      <th scope="col" className="px-3 py-2 text-left font-medium" aria-sort={active ? (ascending ? "ascending" : "descending") : "none"}>
        <button
          type="button"
          className="flex items-center gap-1 hover:text-foreground"
          onClick={() => { if (active) setAscending((a) => !a); else { setSortKey(key); setAscending(true) } }}
        >
          {label}
          <Icon className="h-3 w-3" />
        </button>
      </th>
    )
  }

  if (tasks.length === 0) return <p className="p-8 text-center text-sm text-muted-foreground">No tasks match your filters.</p>

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm" data-testid="task-list">
        <thead className="bg-muted/50 text-muted-foreground">
          <tr>{header("title", "Task")}{header("status", "Status")}{header("priority", "Priority")}{header("assignee", "Assignee")}{header("dueDate", "Due")}</tr>
        </thead>
        <tbody>
          {sorted.map((task) => (
            <tr key={task.id} className="cursor-pointer border-t hover:bg-muted/40" onClick={() => onEdit(task)}>
              <td className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className={`font-medium ${isClosed(task) ? "text-muted-foreground line-through" : ""}`}>{task.title}</span>
                  <TaskProgress task={task} />
                </div>
              </td>
              <td className="px-3 py-2"><Badge variant="outline" className={STATUS_BADGE[task.status]}>{statusLabel(task.status)}</Badge></td>
              <td className="px-3 py-2">{priorityLabel(task.priority)}</td>
              <td className="px-3 py-2">
                {task.assignee ? (
                  <span className="flex items-center gap-2">
                    <Avatar className="h-5 w-5"><AvatarImage src={task.assignee.avatarUrl || "/placeholder-user.jpg"} /><AvatarFallback>{task.assignee.name.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                    {task.assignee.name}
                  </span>
                ) : <span className="text-muted-foreground">Unassigned</span>}
              </td>
              <td className="px-3 py-2">{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : <span className="text-muted-foreground">-</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Tasks with a due date, in date order and grouped by month; overdue open tasks are flagged.
export function TaskTimeline({ tasks, onEdit }: ViewProps) {
  const { groups, undated } = useMemo(() => {
    const dated = tasks.filter((t) => t.dueDate).sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
    const map = new Map<string, BoardTask[]>()
    for (const t of dated) {
      const d = new Date(t.dueDate!)
      const key = d.toLocaleDateString("en-US", { month: "long", year: "numeric" })
      map.set(key, [...(map.get(key) ?? []), t])
    }
    return { groups: [...map], undated: tasks.filter((t) => !t.dueDate) }
  }, [tasks])

  const today = new Date(); today.setHours(0, 0, 0, 0)

  if (tasks.length === 0) return <p className="p-8 text-center text-sm text-muted-foreground">No tasks match your filters.</p>

  return (
    <div className="space-y-6" data-testid="task-timeline">
      {groups.map(([month, items]) => (
        <section key={month}>
          <h3 className="mb-2 text-sm font-semibold">{month}</h3>
          <ol className="space-y-2 border-l pl-4">
            {items.map((t) => {
              const due = new Date(t.dueDate!)
              const overdue = !isClosed(t) && due.getTime() < today.getTime()
              return (
                <li key={t.id}>
                  <button type="button" onClick={() => onEdit(t)} className="flex w-full items-center gap-3 rounded-md border p-2 text-left hover:bg-muted/40">
                    <span className={`w-16 shrink-0 text-xs font-medium ${overdue ? "text-red-600" : "text-muted-foreground"}`}>
                      {due.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                    <span className={`min-w-0 flex-1 truncate text-sm ${isClosed(t) ? "text-muted-foreground line-through" : "font-medium"}`}>{t.title}</span>
                    {overdue && <Badge variant="destructive">Overdue</Badge>}
                    <Badge variant="outline" className={STATUS_BADGE[t.status]}>{statusLabel(t.status)}</Badge>
                    {t.assignee && <span className="hidden text-xs text-muted-foreground sm:inline">{t.assignee.name}</span>}
                  </button>
                </li>
              )
            })}
          </ol>
        </section>
      ))}
      {undated.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-muted-foreground">No due date ({undated.length})</h3>
          <ul className="space-y-1">
            {undated.map((t) => (
              <li key={t.id}>
                <button type="button" onClick={() => onEdit(t)} className="w-full truncate rounded px-2 py-1 text-left text-sm hover:bg-muted/40">{t.title}</button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
