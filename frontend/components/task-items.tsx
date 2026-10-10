"use client"

import { useCallback, useEffect, useState } from "react"
import { CheckSquare, ExternalLink, File, GitBranch, GitCommit, GitPullRequest, Link as LinkIcon, ListChecks, Plus, CircleDot, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { taskItemsApi, tasksApi } from "@/lib/api"
import { TaskStatus } from "@/lib/enums"
import { toast } from "sonner"

interface ChecklistItem {
  id: string
  content: string
  done: boolean
}

interface SubItem {
  id: string
  title: string
  status: number
  assignedTo: string | null
  assigneeName: string | null
}

interface TaskLink {
  id: string
  url: string
  provider: "github" | "gitlab" | "gdrive" | "dropbox" | "other"
  kind: "pull_request" | "issue" | "commit" | "branch" | "repo" | "file" | "link"
  label: string
}

const PROVIDER_NAMES: Record<TaskLink["provider"], string> = {
  github: "GitHub", gitlab: "GitLab", gdrive: "Google Drive", dropbox: "Dropbox", other: "Link",
}

function LinkKindIcon({ kind }: { kind: TaskLink["kind"] }) {
  const cls = "h-4 w-4 shrink-0 text-muted-foreground"
  switch (kind) {
    case "pull_request": return <GitPullRequest className={cls} />
    case "commit": return <GitCommit className={cls} />
    case "branch": return <GitBranch className={cls} />
    case "issue": return <CircleDot className={cls} />
    case "file": return <File className={cls} />
    default: return <LinkIcon className={cls} />
  }
}

interface TaskItemsProps {
  taskId: string
  users: { id: string; name: string }[]
  // Called after any change so task cards can refresh their progress counts
  onChanged?: () => void
}

const UNASSIGNED = "unassigned"

export function TaskItems({ taskId, users, onChanged }: TaskItemsProps) {
  // The caller may list the current user twice (as themself and as a team member)
  const assignees = users.filter((u, i) => users.findIndex((x) => x.id === u.id) === i)
  const [checklist, setChecklist] = useState<ChecklistItem[]>([])
  const [subItems, setSubItems] = useState<SubItem[]>([])
  const [newCheck, setNewCheck] = useState("")
  const [newSub, setNewSub] = useState("")
  const [newSubAssignee, setNewSubAssignee] = useState(UNASSIGNED)
  const [links, setLinks] = useState<TaskLink[]>([])
  const [newLink, setNewLink] = useState("")

  const load = useCallback(async () => {
    try {
      const [items, subs, taskLinks] = await Promise.all([
        taskItemsApi.getChecklist(taskId),
        taskItemsApi.getSubtasks(taskId),
        taskItemsApi.getLinks(taskId),
      ])
      setChecklist(items)
      setSubItems(subs)
      setLinks(taskLinks)
    } catch {
      toast.error("Failed to load checklist and sub-items")
    }
  }, [taskId])

  useEffect(() => {
    load()
  }, [load])

  const run = async (action: () => Promise<void>, errorMessage: string) => {
    try {
      await action()
      onChanged?.()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || errorMessage)
    }
  }

  const addCheck = (e: React.FormEvent) => {
    e.preventDefault()
    const content = newCheck.trim()
    if (!content) return
    run(async () => {
      const item = await taskItemsApi.addChecklistItem(taskId, content)
      setChecklist((prev) => [...prev, item])
      setNewCheck("")
    }, "Failed to add checklist item")
  }

  const toggleCheck = (item: ChecklistItem, done: boolean) => {
    setChecklist((prev) => prev.map((c) => (c.id === item.id ? { ...c, done } : c)))
    run(async () => {
      await taskItemsApi.updateChecklistItem(taskId, item.id, { done })
    }, "Failed to update checklist item").catch(() => load())
  }

  const removeCheck = (item: ChecklistItem) => {
    run(async () => {
      await taskItemsApi.deleteChecklistItem(taskId, item.id)
      setChecklist((prev) => prev.filter((c) => c.id !== item.id))
    }, "Failed to delete checklist item")
  }

  const addSub = (e: React.FormEvent) => {
    e.preventDefault()
    const title = newSub.trim()
    if (!title) return
    run(async () => {
      const sub = await taskItemsApi.addSubtask(taskId, {
        title,
        assignedTo: newSubAssignee === UNASSIGNED ? null : newSubAssignee,
      })
      setSubItems((prev) => [...prev, sub])
      setNewSub("")
    }, "Failed to add sub-item")
  }

  const toggleSub = (sub: SubItem, done: boolean) => {
    const status = done ? TaskStatus.DONE : TaskStatus.TODO
    setSubItems((prev) => prev.map((s) => (s.id === sub.id ? { ...s, status } : s)))
    run(async () => {
      await tasksApi.updateTask(sub.id, { status })
    }, "Failed to update sub-item").catch(() => load())
  }

  const addLink = (e: React.FormEvent) => {
    e.preventDefault()
    const url = newLink.trim()
    if (!url) return
    run(async () => {
      const link = await taskItemsApi.addLink(taskId, url)
      setLinks((prev) => [...prev, link])
      setNewLink("")
    }, "Failed to add link")
  }

  const removeLink = (link: TaskLink) => {
    run(async () => {
      await taskItemsApi.deleteLink(taskId, link.id)
      setLinks((prev) => prev.filter((l) => l.id !== link.id))
    }, "Failed to remove link")
  }

  const checkDone = checklist.filter((c) => c.done).length
  const subDone = subItems.filter((s) => s.status === TaskStatus.DONE).length

  return (
    <div className="space-y-6 border-t pt-4">
      <section aria-label="Checklist">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="flex items-center gap-2 text-sm font-medium">
            <ListChecks className="h-4 w-4" /> Checklist
          </h4>
          {checklist.length > 0 && <span className="text-xs text-muted-foreground">{checkDone}/{checklist.length}</span>}
        </div>
        <ul className="space-y-1">
          {checklist.map((item) => (
            <li key={item.id} className="group flex items-center gap-2">
              <Checkbox checked={item.done} onCheckedChange={(v) => toggleCheck(item, v === true)} aria-label={item.content} />
              <span className={`flex-1 text-sm ${item.done ? "text-muted-foreground line-through" : ""}`}>{item.content}</span>
              <Button type="button" variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 focus:opacity-100" onClick={() => removeCheck(item)} aria-label={`Delete ${item.content}`}>
                <X className="h-3 w-3" />
              </Button>
            </li>
          ))}
        </ul>
        <form onSubmit={addCheck} className="mt-2 flex gap-2">
          <Input value={newCheck} onChange={(e) => setNewCheck(e.target.value)} placeholder="Add checklist item" className="h-8 text-sm" maxLength={500} />
          <Button type="submit" size="sm" variant="outline" className="h-8" disabled={!newCheck.trim()} aria-label="Add checklist item">
            <Plus className="h-4 w-4" />
          </Button>
        </form>
      </section>

      <section aria-label="Sub-items">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="flex items-center gap-2 text-sm font-medium">
            <CheckSquare className="h-4 w-4" /> Sub-items
          </h4>
          {subItems.length > 0 && <span className="text-xs text-muted-foreground">{subDone}/{subItems.length}</span>}
        </div>
        <ul className="space-y-1">
          {subItems.map((sub) => (
            <li key={sub.id} className="flex items-center gap-2">
              <Checkbox checked={sub.status === TaskStatus.DONE} onCheckedChange={(v) => toggleSub(sub, v === true)} aria-label={sub.title} />
              <span className={`flex-1 text-sm ${sub.status === TaskStatus.DONE ? "text-muted-foreground line-through" : ""}`}>{sub.title}</span>
              {sub.assigneeName && <span className="text-xs text-muted-foreground">{sub.assigneeName}</span>}
            </li>
          ))}
        </ul>
        <form onSubmit={addSub} className="mt-2 flex gap-2">
          <Input value={newSub} onChange={(e) => setNewSub(e.target.value)} placeholder="Add sub-item" className="h-8 text-sm" maxLength={255} />
          <Select value={newSubAssignee} onValueChange={setNewSubAssignee}>
            <SelectTrigger className="h-8 w-36 text-xs" aria-label="Sub-item assignee">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
              {assignees.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="submit" size="sm" variant="outline" className="h-8" disabled={!newSub.trim()} aria-label="Add sub-item">
            <Plus className="h-4 w-4" />
          </Button>
        </form>
      </section>

      <section aria-label="Links">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="flex items-center gap-2 text-sm font-medium">
            <LinkIcon className="h-4 w-4" /> Links
          </h4>
          {links.length > 0 && <span className="text-xs text-muted-foreground">{links.length}</span>}
        </div>
        <ul className="space-y-1">
          {links.map((link) => (
            <li key={link.id} className="group flex items-center gap-2">
              <LinkKindIcon kind={link.kind} />
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="min-w-0 flex-1 truncate text-sm hover:underline"
                title={link.url}
              >
                {link.label}
              </a>
              <span className="text-xs text-muted-foreground">{PROVIDER_NAMES[link.provider]}</span>
              <ExternalLink className="h-3 w-3 text-muted-foreground" aria-hidden />
              <Button type="button" variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 focus:opacity-100" onClick={() => removeLink(link)} aria-label={`Remove ${link.label}`}>
                <X className="h-3 w-3" />
              </Button>
            </li>
          ))}
        </ul>
        <form onSubmit={addLink} className="mt-2 flex gap-2">
          <Input value={newLink} onChange={(e) => setNewLink(e.target.value)} placeholder="Paste a GitHub/GitLab PR, commit or issue, or a Drive/Dropbox link" className="h-8 text-sm" maxLength={2048} />
          <Button type="submit" size="sm" variant="outline" className="h-8" disabled={!newLink.trim()} aria-label="Add link">
            <Plus className="h-4 w-4" />
          </Button>
        </form>
      </section>
    </div>
  )
}

// Compact progress badges for task cards
export function TaskProgress({ task }: { task: { subtaskTotal?: number; subtaskDone?: number; checklistTotal?: number; checklistDone?: number } }) {
  const subTotal = task.subtaskTotal ?? 0
  const checkTotal = task.checklistTotal ?? 0
  if (subTotal === 0 && checkTotal === 0) return null

  return (
    <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
      {checkTotal > 0 && (
        <span className="flex items-center gap-1" title="Checklist progress">
          <ListChecks className="h-3 w-3" />{task.checklistDone ?? 0}/{checkTotal}
        </span>
      )}
      {subTotal > 0 && (
        <span className="flex items-center gap-1" title="Sub-items done">
          <CheckSquare className="h-3 w-3" />{task.subtaskDone ?? 0}/{subTotal}
        </span>
      )}
    </span>
  )
}
