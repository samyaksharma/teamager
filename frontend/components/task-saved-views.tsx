"use client"

import { useCallback, useEffect, useState } from "react"
import { Bookmark, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { taskViewsApi, type TaskViewFilters } from "@/lib/api"

interface SavedView {
  id: string
  name: string
  filters: TaskViewFilters
}

interface TaskSavedViewsProps {
  filters: TaskViewFilters
  onApply: (filters: TaskViewFilters) => void
}

const sameFilters = (a: TaskViewFilters, b: TaskViewFilters) =>
  a.status === b.status && a.assignee === b.assignee && a.team === b.team && a.search === b.search

export function TaskSavedViews({ filters, onApply }: TaskSavedViewsProps) {
  const [open, setOpen] = useState(false)
  const [views, setViews] = useState<SavedView[]>([])
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      setViews(await taskViewsApi.list())
    } catch {
      toast.error("Failed to load saved views")
    }
  }, [])

  useEffect(() => {
    if (open) load()
  }, [open, load])

  const active = views.find((v) => sameFilters(v.filters, filters))

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    setBusy(true)
    try {
      await taskViewsApi.save(trimmed, filters)
      setName("")
      await load()
      toast.success(`Saved view "${trimmed}"`)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to save view")
    } finally {
      setBusy(false)
    }
  }

  const remove = async (view: SavedView) => {
    try {
      await taskViewsApi.remove(view.id)
      setViews((prev) => prev.filter((v) => v.id !== view.id))
    } catch {
      toast.error("Failed to delete view")
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1 text-xs">
          <Bookmark className="h-3 w-3" />
          {active ? active.name : "Views"}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        <div className="max-h-60 overflow-y-auto">
          {views.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">No saved views yet.</p>
          ) : (
            <ul>
              {views.map((v) => (
                <li key={v.id} className="group flex items-center gap-1 px-2">
                  <button
                    type="button"
                    className={`flex-1 truncate rounded px-2 py-2 text-left text-sm hover:bg-muted ${active?.id === v.id ? "font-medium" : ""}`}
                    onClick={() => { onApply(v.filters); setOpen(false) }}
                  >
                    {v.name}
                  </button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 focus:opacity-100" onClick={() => remove(v)} aria-label={`Delete view ${v.name}`}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <form onSubmit={save} className="flex gap-2 border-t p-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Save current filters as..." className="h-8 text-sm" maxLength={80} />
          <Button type="submit" size="sm" className="h-8" disabled={busy || !name.trim()}>Save</Button>
        </form>
      </PopoverContent>
    </Popover>
  )
}
