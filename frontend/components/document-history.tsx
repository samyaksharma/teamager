"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { format, formatDistanceToNow } from "date-fns"
import { History, RotateCcw, Tag } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { documentVersionsApi } from "@/lib/api"
import { sanitizeHtml } from "@/lib/sanitize-html"

interface VersionSummary {
  id: string
  title: string
  label: string | null
  updatedAt: string
  authorName: string | null
  size: number
}

interface VersionDetail extends VersionSummary {
  content: string
}

interface DocumentHistoryProps {
  documentId: string
  canEdit: boolean
  // Saves the editor's current content so history includes the latest edits
  flush: () => Promise<void>
  // Replaces the open editor's content (so collaborators receive the restored text)
  applyContent: (html: string) => void
}

export function DocumentHistory({ documentId, canEdit, flush, applyContent }: DocumentHistoryProps) {
  const [open, setOpen] = useState(false)
  const [versions, setVersions] = useState<VersionSummary[]>([])
  const [selected, setSelected] = useState<VersionDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setVersions(await documentVersionsApi.list(documentId))
    } catch {
      toast.error("Failed to load version history")
    } finally {
      setLoading(false)
    }
  }, [documentId])

  useEffect(() => {
    if (!open) return
    setSelected(null)
    ;(async () => {
      if (canEdit) await flush().catch(() => {})
      await load()
    })()
    // flush is recreated every render of the editor; only reload when the panel opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, load, canEdit])

  const select = async (id: string) => {
    try {
      setSelected(await documentVersionsApi.get(documentId, id))
    } catch {
      toast.error("Failed to load this version")
    }
  }

  const saveNamed = async (e: React.FormEvent) => {
    e.preventDefault()
    const label = name.trim()
    if (!label) return
    setBusy(true)
    try {
      await flush().catch(() => {})
      await documentVersionsApi.saveNamed(documentId, label)
      setName("")
      await load()
      toast.success(`Saved version "${label}"`)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to save version")
    } finally {
      setBusy(false)
    }
  }

  const restore = async () => {
    if (!selected) return
    setBusy(true)
    try {
      const result = await documentVersionsApi.restore(documentId, selected.id)
      applyContent(result.content)
      toast.success("Version restored")
      setOpen(false)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to restore version")
    } finally {
      setBusy(false)
    }
  }

  const previewHtml = useMemo(() => (selected ? sanitizeHtml(selected.content) : ""), [selected])

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <History className="mr-2 h-4 w-4" />
          History
        </Button>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b p-4">
          <SheetTitle>Version history</SheetTitle>
          <SheetDescription>Browse earlier versions of this page and restore one.</SheetDescription>
        </SheetHeader>

        {canEdit && (
          <form onSubmit={saveNamed} className="flex gap-2 border-b p-4">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name the current version" maxLength={120} />
            <Button type="submit" size="sm" disabled={busy || !name.trim()}>
              <Tag className="mr-2 h-4 w-4" />
              Save
            </Button>
          </form>
        )}

        {selected ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center justify-between gap-2 border-b p-4">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{selected.label ?? selected.title}</div>
                <div className="text-xs text-muted-foreground">
                  {selected.authorName ?? "Unknown"} · {format(new Date(selected.updatedAt), "MMM d, yyyy h:mm a")}
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>Back</Button>
                {canEdit && (
                  <Button size="sm" onClick={restore} disabled={busy}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Restore
                  </Button>
                )}
              </div>
            </div>
            <ScrollArea className="flex-1">
              <div
                className="prose prose-sm dark:prose-invert max-w-none p-4"
                data-testid="version-preview"
                dangerouslySetInnerHTML={{ __html: previewHtml || "<p><em>This version is empty.</em></p>" }}
              />
            </ScrollArea>
          </div>
        ) : (
          <ScrollArea className="flex-1">
            {loading ? (
              <p className="p-6 text-center text-sm text-muted-foreground">Loading...</p>
            ) : versions.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                No earlier versions yet. Versions appear as the page is edited.
              </p>
            ) : (
              <ul>
                {versions.map((v, i) => (
                  <li key={v.id}>
                    <button
                      type="button"
                      onClick={() => select(v.id)}
                      className="flex w-full flex-col gap-1 border-b px-4 py-3 text-left hover:bg-muted/60"
                    >
                      <span className="flex items-center gap-2 text-sm font-medium">
                        {v.label ?? format(new Date(v.updatedAt), "MMM d, h:mm a")}
                        {i === 0 && <Badge variant="secondary">Latest</Badge>}
                        {v.label && <Badge variant="outline">Named</Badge>}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {v.authorName ?? "Unknown"} · {formatDistanceToNow(new Date(v.updatedAt), { addSuffix: true })}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        )}
      </SheetContent>
    </Sheet>
  )
}
