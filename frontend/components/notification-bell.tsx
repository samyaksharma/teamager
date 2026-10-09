"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import { Bell } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { notificationsApi } from "@/lib/api"

interface NotificationItem {
  id: string
  module: "documents" | "tasks" | "messages"
  title: string
  body?: string | null
  link?: string | null
  readAt?: string | null
  createdAt: string
  actorName?: string | null
}

type Settings = { documents: boolean; tasks: boolean; messages: boolean }

const MODULE_LABELS: { key: keyof Settings; label: string }[] = [
  { key: "documents", label: "Documents" },
  { key: "tasks", label: "Tasks" },
  { key: "messages", label: "Messages" },
]

const POLL_INTERVAL_MS = 15000

export function NotificationBell() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [settings, setSettings] = useState<Settings | null>(null)

  // Only the newest refresh may update state, so a slow response can't undo an optimistic update
  const refreshSeq = useRef(0)

  const refresh = useCallback(async () => {
    const seq = ++refreshSeq.current
    try {
      const data = await notificationsApi.list()
      if (seq !== refreshSeq.current) return
      setItems(data.notifications)
      setUnreadCount(data.unreadCount)
    } catch {
      // Keep showing what we have; the next poll will retry
    }
  }, [])

  // Poll while the tab is visible (the app polls for messages the same way)
  useEffect(() => {
    refresh()
    const id = setInterval(() => {
      if (document.visibilityState === "visible") refresh()
    }, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [refresh])

  useEffect(() => {
    if (!open) return
    refresh()
    notificationsApi.getSettings().then(setSettings).catch(() => {})
  }, [open, refresh])

  const handleSelect = async (item: NotificationItem) => {
    if (!item.readAt) {
      setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n)))
      setUnreadCount((c) => Math.max(0, c - 1))
      refreshSeq.current++
      notificationsApi.markRead(item.id).catch(() => {}).finally(refresh)
    }
    if (item.link) {
      setOpen(false)
      router.push(item.link)
    }
  }

  const handleMarkAllRead = async () => {
    setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })))
    setUnreadCount(0)
    refreshSeq.current++
    await notificationsApi.markAllRead().catch(() => {})
    refresh()
  }

  const handleToggle = async (key: keyof Settings, value: boolean) => {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev))
    try {
      setSettings(await notificationsApi.updateSettings({ [key]: value }))
    } catch {
      setSettings((prev) => (prev ? { ...prev, [key]: !value } : prev))
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-8 w-8" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span
              className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground"
              data-testid="notification-badge"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between px-4 py-3">
          <h3 className="font-semibold">Activity</h3>
          <Button variant="ghost" size="sm" className="h-7 text-xs" disabled={unreadCount === 0} onClick={handleMarkAllRead}>
            Mark all as read
          </Button>
        </div>
        <Separator />
        <ScrollArea className="max-h-80">
          {items.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">You're all caught up.</p>
          ) : (
            <ul>
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(item)}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/60"
                  >
                    <span
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.readAt ? "bg-transparent" : "bg-primary"}`}
                      aria-label={item.readAt ? "Read" : "Unread"}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm">
                        <span className="font-medium">{item.actorName ?? "Someone"}</span> {item.title}
                      </span>
                      {item.body && <span className="block truncate text-sm text-muted-foreground">{item.body}</span>}
                      <span className="block text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
        <Separator />
        <div className="px-4 py-3">
          <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">Notify me about</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {MODULE_LABELS.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <Switch
                  checked={settings?.[key] ?? true}
                  disabled={!settings}
                  onCheckedChange={(v) => handleToggle(key, v)}
                  aria-label={`${label} notifications`}
                />
                {label}
              </label>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
