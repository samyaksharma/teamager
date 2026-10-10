"use client"

import { useState } from "react"
import { CalendarDays, Copy, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { calendarApi } from "@/lib/api"

export function CalendarSubscribe() {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState("")
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      setUrl((await calendarApi.getFeed()).url)
    } catch {
      toast.error("Failed to load your calendar link")
    } finally {
      setLoading(false)
    }
  }

  const rotate = async () => {
    if (!window.confirm("Create a new link? Calendars subscribed to the old link will stop updating.")) return
    setLoading(true)
    try {
      setUrl((await calendarApi.rotateFeed()).url)
      toast.success("New calendar link created")
    } catch {
      toast.error("Failed to create a new link")
    } finally {
      setLoading(false)
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      toast.success("Link copied")
    } catch {
      toast.error("Couldn't copy. Select the link and copy it manually.")
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (next && !url) load() }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          <CalendarDays className="h-4 w-4" />
          <span className="hidden sm:inline">Subscribe</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Subscribe in your calendar app</DialogTitle>
          <DialogDescription>
            Your tasks with due dates appear as all-day events in Google Calendar, Outlook or Apple Calendar.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input readOnly value={loading && !url ? "Loading..." : url} aria-label="Calendar feed link" onFocus={(e) => e.currentTarget.select()} />
            <Button type="button" variant="outline" onClick={copy} disabled={!url} aria-label="Copy link">
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Copy the link above.</li>
            <li>Google Calendar: Other calendars, then From URL. Outlook: Add calendar, then Subscribe from web.</li>
            <li>Paste the link and save. Updates can take a few hours to appear.</li>
          </ol>
          <p className="text-xs text-muted-foreground">
            Anyone with this link can see your task titles, so keep it private. Your calendar provider must be able to
            reach this server, so it won&apos;t sync from a local development address.
          </p>
          <Button type="button" variant="ghost" size="sm" onClick={rotate} disabled={loading || !url}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Create a new link
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
