"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { formatDistanceToNow } from "date-fns"
import type { Editor } from "@tiptap/react"
import { Check, MessageSquare, RotateCcw, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { documentCommentsApi } from "@/lib/api"

interface DocComment {
  id: string
  parentId: string | null
  content: string
  quote: string | null
  kind: "comment" | "suggestion"
  suggestion: string | null
  status: "open" | "resolved" | "accepted" | "rejected"
  createdBy: string
  createdAt: string
  authorName: string | null
}

interface DocumentCommentsProps {
  documentId: string
  editor: Editor
  currentUserId: string
  canComment: boolean
  canEdit: boolean
  canAdmin: boolean
  // Saves the editor content after a suggestion is applied
  flush: () => Promise<void>
}

// Find `quote` inside a single text block and return its document range
function findQuoteRange(editor: Editor, quote: string) {
  let range: { from: number; to: number } | null = null
  editor.state.doc.descendants((node, pos) => {
    if (range || !node.isTextblock) return !range
    const index = node.textContent.indexOf(quote)
    if (index === -1) return false
    const from = pos + 1 + index
    const to = from + quote.length
    // Positions only line up with text offsets when the block has no inline atoms (images etc.)
    if (editor.state.doc.textBetween(from, to) === quote) range = { from, to }
    return false
  })
  return range
}

export function DocumentComments({ documentId, editor, currentUserId, canComment, canEdit, canAdmin, flush }: DocumentCommentsProps) {
  const [open, setOpen] = useState(false)
  const [comments, setComments] = useState<DocComment[]>([])
  const [loading, setLoading] = useState(false)
  const [showClosed, setShowClosed] = useState(false)
  const [mode, setMode] = useState<"comment" | "suggest">("comment")
  const [text, setText] = useState("")
  const [replacement, setReplacement] = useState("")
  const [quote, setQuote] = useState("")
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState("")
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setComments(await documentCommentsApi.list(documentId))
    } catch {
      toast.error("Failed to load comments")
    } finally {
      setLoading(false)
    }
  }, [documentId])

  const captureSelection = useCallback(() => {
    const { from, to, empty } = editor.state.selection
    setQuote(empty ? "" : editor.state.doc.textBetween(from, to, " ").trim().slice(0, 1000))
  }, [editor])

  // Keep the list fresh while the panel is open (other people comment while you read)
  useEffect(() => {
    if (!open) return
    captureSelection()
    load()
    const timer = setInterval(load, 10000)
    return () => clearInterval(timer)
  }, [open, load, captureSelection])

  const threads = useMemo(() => {
    const top = comments.filter((c) => !c.parentId)
    return top.map((c) => ({ ...c, replies: comments.filter((r) => r.parentId === c.id) }))
  }, [comments])

  const isClosed = (c: DocComment) => c.status === "resolved" || c.status === "accepted" || c.status === "rejected"
  const openCount = threads.filter((t) => !isClosed(t)).length
  const visible = threads.filter((t) => showClosed || !isClosed(t))

  const run = async (action: () => Promise<void>, fallbackError: string) => {
    setBusy(true)
    try {
      await action()
    } catch (err: any) {
      toast.error(err?.response?.data?.message || fallbackError)
    } finally {
      setBusy(false)
    }
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const isSuggest = mode === "suggest"
    if (isSuggest ? !quote : !text.trim()) return
    run(async () => {
      await documentCommentsApi.add(documentId, {
        content: text.trim(),
        quote: quote || undefined,
        suggestion: isSuggest ? replacement : undefined,
      })
      setText("")
      setReplacement("")
      setQuote("")
      await load()
    }, "Failed to add comment")
  }

  const submitReply = (parentId: string) => {
    if (!replyText.trim()) return
    run(async () => {
      await documentCommentsApi.add(documentId, { content: replyText.trim(), parentId })
      setReplyText("")
      setReplyTo(null)
      await load()
    }, "Failed to reply")
  }

  const setStatus = (c: DocComment, status: string) =>
    run(async () => {
      await documentCommentsApi.setStatus(documentId, c.id, status)
      await load()
    }, "Failed to update comment")

  const accept = (c: DocComment) =>
    run(async () => {
      const range = c.quote ? findQuoteRange(editor, c.quote) : null
      if (!range) {
        toast.error("That text has changed, so the suggestion can't be applied. You can reject it instead.")
        return
      }
      editor.chain().focus().insertContentAt(range, c.suggestion ?? "").run()
      await flush().catch(() => {})
      await documentCommentsApi.setStatus(documentId, c.id, "accepted")
      toast.success("Suggestion applied")
      await load()
    }, "Failed to accept suggestion")

  const remove = (c: DocComment) =>
    run(async () => {
      await documentCommentsApi.remove(documentId, c.id)
      await load()
    }, "Failed to delete comment")

  const canDelete = (c: DocComment) => c.createdBy === currentUserId || canAdmin

  const Meta = ({ c }: { c: DocComment }) => (
    <span className="text-xs text-muted-foreground">
      {c.authorName ?? "Unknown"} · {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
    </span>
  )

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <MessageSquare className="mr-2 h-4 w-4" />
          Comments
          {openCount > 0 && <Badge variant="secondary" className="ml-2">{openCount}</Badge>}
        </Button>
      </SheetTrigger>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b p-4">
          <SheetTitle>Comments and suggestions</SheetTitle>
          <SheetDescription>Discuss the page, or suggest a change to selected text.</SheetDescription>
        </SheetHeader>

        {canComment ? (
          <form onSubmit={submit} className="space-y-3 border-b p-4">
            <div className="flex gap-2">
              <Button type="button" size="sm" variant={mode === "comment" ? "default" : "outline"} onClick={() => setMode("comment")}>Comment</Button>
              <Button type="button" size="sm" variant={mode === "suggest" ? "default" : "outline"} onClick={() => setMode("suggest")}>Suggest edit</Button>
              <Button type="button" size="sm" variant="ghost" className="ml-auto" onClick={captureSelection}>Use selected text</Button>
            </div>
            {quote ? (
              <div className="flex items-start gap-2 rounded-md border-l-4 bg-muted/50 p-2 text-sm">
                <span className="flex-1 break-words italic">{quote}</span>
                <Button type="button" variant="ghost" size="icon" className="h-5 w-5" onClick={() => setQuote("")} aria-label="Clear quoted text">
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : mode === "suggest" ? (
              <p className="text-xs text-muted-foreground">Select text in the page, then press "Use selected text".</p>
            ) : null}
            {mode === "suggest" && (
              <Textarea value={replacement} onChange={(e) => setReplacement(e.target.value)} placeholder="Replace the selected text with... (leave empty to suggest deleting it)" rows={2} />
            )}
            <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={mode === "suggest" ? "Why? (optional)" : "Write a comment..."} rows={2} maxLength={5000} />
            <Button type="submit" size="sm" disabled={busy || (mode === "suggest" ? !quote : !text.trim())}>
              {mode === "suggest" ? "Suggest" : "Comment"}
            </Button>
          </form>
        ) : (
          <p className="border-b p-4 text-sm text-muted-foreground">You have read-only access, so you can't add comments.</p>
        )}

        <div className="flex items-center justify-between border-b px-4 py-2">
          <span className="text-xs text-muted-foreground">{openCount} open</span>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowClosed((v) => !v)}>
            {showClosed ? "Hide closed" : "Show closed"}
          </Button>
        </div>

        <ScrollArea className="flex-1">
          {loading && comments.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Loading...</p>
          ) : visible.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              {threads.length === 0 ? "No comments yet." : "No open comments."}
            </p>
          ) : (
            <ul>
              {visible.map((t) => (
                <li key={t.id} className={`border-b p-4 ${isClosed(t) ? "opacity-70" : ""}`} data-testid="comment-thread">
                  <div className="flex items-start justify-between gap-2">
                    <Meta c={t} />
                    <div className="flex items-center gap-1">
                      {t.kind === "suggestion" && <Badge variant="outline">Suggestion</Badge>}
                      {isClosed(t) && <Badge variant="secondary" className="capitalize">{t.status}</Badge>}
                      {canDelete(t) && (
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => remove(t)} aria-label="Delete comment">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                  {t.quote && <div className="mt-2 border-l-4 bg-muted/50 px-2 py-1 text-sm italic">{t.quote}</div>}
                  {t.kind === "suggestion" && (
                    <div className="mt-2 rounded-md bg-muted/30 p-2 text-sm">
                      <span className="text-xs text-muted-foreground">Change to: </span>
                      {t.suggestion ? <span className="font-medium">{t.suggestion}</span> : <em>(delete)</em>}
                    </div>
                  )}
                  {t.content && <p className="mt-2 whitespace-pre-wrap break-words text-sm">{t.content}</p>}

                  {t.replies.map((r) => (
                    <div key={r.id} className="mt-3 border-l pl-3">
                      <div className="flex items-start justify-between">
                        <Meta c={r} />
                        {canDelete(r) && (
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => remove(r)} aria-label="Delete reply">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      <p className="whitespace-pre-wrap break-words text-sm">{r.content}</p>
                    </div>
                  ))}

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {t.kind === "suggestion" && t.status === "open" && canEdit && (
                      <>
                        <Button size="sm" disabled={busy} onClick={() => accept(t)}><Check className="mr-1 h-3 w-3" />Accept</Button>
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => setStatus(t, "rejected")}><X className="mr-1 h-3 w-3" />Reject</Button>
                      </>
                    )}
                    {t.kind === "comment" && (t.createdBy === currentUserId || canEdit) && (
                      t.status === "open" ? (
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => setStatus(t, "resolved")}><Check className="mr-1 h-3 w-3" />Resolve</Button>
                      ) : (
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => setStatus(t, "open")}><RotateCcw className="mr-1 h-3 w-3" />Reopen</Button>
                      )
                    )}
                    {t.kind === "comment" && canComment && replyTo !== t.id && (
                      <Button size="sm" variant="ghost" onClick={() => { setReplyTo(t.id); setReplyText("") }}>Reply</Button>
                    )}
                  </div>
                  {replyTo === t.id && (
                    <div className="mt-2 flex gap-2">
                      <Input value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Reply..." autoFocus
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submitReply(t.id) } }} />
                      <Button size="sm" disabled={busy || !replyText.trim()} onClick={() => submitReply(t.id)}>Send</Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
