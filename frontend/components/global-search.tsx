"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import { Building2, Calendar, CheckSquare, FilePlus, FileText, Hash, Home, LogOut, MessageSquare, Moon, PlusSquare, Search, Settings, Users } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Toggle } from "@/components/ui/toggle"
import { searchApi, teamApi } from "@/lib/api"
import { useAuth } from "@/lib/authContext"
import { requestOpenNew } from "@/lib/open-new"
import { useMessages } from "@/app/dashboard/messages/messagesContext"
import { EnumLabels } from "@/lib/enums"

type SearchType = "documents" | "tasks" | "messages"

const TYPE_OPTIONS: { key: SearchType; label: string }[] = [
  { key: "documents", label: "Documents" },
  { key: "tasks", label: "Tasks" },
  { key: "messages", label: "Messages" },
]

interface Results {
  suggestions: boolean
  documents: { id: string; title: string; snippet: string | null; updatedAt: string; authorName: string | null; teamName: string | null }[]
  tasks: { id: string; title: string; snippet: string | null; status: number | null; assigneeName: string | null; createdAt: string }[]
  messages: {
    id: string
    kind: "channel" | "direct"
    content: string
    createdAt: string
    authorName: string | null
    channelId: string | null
    channelName: string | null
    contactId: string | null
  }[]
}

const ALL_TYPES = TYPE_OPTIONS.map((t) => t.key)
const ALL_PEOPLE = "all"

interface GlobalSearchProps {
  // Only one instance should own the Ctrl/Cmd+K shortcut
  hotkey?: boolean
  triggerClassName?: string
}

export function GlobalSearch({ hotkey = false, triggerClassName }: GlobalSearchProps) {
  const router = useRouter()
  const { teams, logout, organizations, currentOrganization, setCurrentOrganization } = useAuth()
  const { resolvedTheme, setTheme } = useTheme()
  const { setActiveChannel, setActiveDirectContact } = useMessages()

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [types, setTypes] = useState<SearchType[]>(ALL_TYPES)
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [participant, setParticipant] = useState(ALL_PEOPLE)
  const [people, setPeople] = useState<{ id: string; name: string }[]>([])
  const [results, setResults] = useState<Results | null>(null)
  const [loading, setLoading] = useState(false)
  const requestSeq = useRef(0)

  // Start fresh each time so filters from a previous search don't silently apply
  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) {
      setQuery("")
      setTypes(ALL_TYPES)
      setFrom("")
      setTo("")
      setParticipant(ALL_PEOPLE)
      setResults(null)
    }
  }

  useEffect(() => {
    if (!hotkey) return
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        handleOpenChange(!open)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [hotkey, open])

  // Teammates for the participant filter, loaded the first time the dialog opens
  useEffect(() => {
    if (!open || people.length > 0 || teams.length === 0) return
    Promise.all(teams.map((t) => teamApi.getMembers(t.id).catch(() => [])))
      .then((lists) => {
        const byId = new Map<string, { id: string; name: string }>()
        for (const m of lists.flat()) byId.set(m.id, { id: m.id, name: m.name })
        setPeople([...byId.values()].sort((a, b) => a.name.localeCompare(b.name)))
      })
  }, [open, people.length, teams])

  // Debounced search; an empty query returns suggestions (recent activity, tasks assigned to you)
  useEffect(() => {
    if (!open) return
    const seq = ++requestSeq.current
    setLoading(true)
    const timer = setTimeout(async () => {
      try {
        const data = await searchApi.search({
          q: query.trim() || undefined,
          types,
          from: from || undefined,
          to: to || undefined,
          participant: participant === ALL_PEOPLE ? undefined : participant,
        })
        if (seq === requestSeq.current) setResults(data)
      } catch {
        if (seq === requestSeq.current) setResults(null)
      } finally {
        if (seq === requestSeq.current) setLoading(false)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [open, query, types, from, to, participant])

  const toggleType = (type: SearchType, pressed: boolean) => {
    setTypes((prev) => {
      const next = pressed ? [...prev, type] : prev.filter((t) => t !== type)
      return next.length === 0 ? prev : next
    })
  }

  const go = (action: () => void) => {
    handleOpenChange(false)
    action()
  }

  const commands = useMemo(
    () => [
      { id: "go-home", label: "Go to Home", keywords: "dashboard overview", icon: Home, run: () => router.push("/dashboard") },
      { id: "go-tasks", label: "Go to Tasks", keywords: "board kanban list", icon: CheckSquare, run: () => router.push("/dashboard/tasks") },
      { id: "go-calendar", label: "Go to Calendar", keywords: "schedule due dates", icon: Calendar, run: () => router.push("/dashboard/calendar") },
      { id: "go-documents", label: "Go to Documents", keywords: "pages docs notes", icon: FileText, run: () => router.push("/dashboard/documents") },
      { id: "go-messages", label: "Go to Messages", keywords: "chat channels dm", icon: MessageSquare, run: () => router.push("/dashboard/messages") },
      { id: "go-settings", label: "Go to Settings", keywords: "workspace profile preferences", icon: Settings, run: () => router.push("/dashboard/settings") },
      { id: "go-members", label: "Go to Members", keywords: "people team roles", icon: Users, run: () => router.push("/dashboard/members") },
      {
        id: "new-task", label: "Create task", keywords: "new add issue", icon: PlusSquare,
        run: () => { router.push("/dashboard/tasks"); requestOpenNew("task") },
      },
      {
        id: "new-document", label: "Create document", keywords: "new add page template", icon: FilePlus,
        run: () => { router.push("/dashboard/documents"); requestOpenNew("document") },
      },
      {
        id: "toggle-theme", label: resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode",
        keywords: "theme appearance dark light", icon: Moon,
        run: () => setTheme(resolvedTheme === "dark" ? "light" : "dark"),
      },
      ...organizations
        .filter((org) => org.id !== currentOrganization?.id)
        .map((org) => ({
          id: `org-${org.id}`,
          label: `Switch to ${org.name}`,
          keywords: "organization workspace switch change",
          icon: Building2,
          run: () => setCurrentOrganization(org),
        })),
      { id: "logout", label: "Log out", keywords: "sign out", icon: LogOut, run: () => { logout() } },
    ],
    [router, resolvedTheme, setTheme, logout, organizations, currentOrganization, setCurrentOrganization]
  )

  // Commands match on their label/keywords; with an empty box only a few are shown
  const visibleCommands = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return commands.slice(0, 6)
    return commands.filter((c) => `${c.label} ${c.keywords}`.toLowerCase().includes(q))
  }, [commands, query])

  const hasResults = !!results && (results.documents.length + results.tasks.length + results.messages.length > 0)
  const prefix = results?.suggestions ? "Suggested " : ""

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className={triggerClassName ?? "h-8 w-8"}
        onClick={() => setOpen(true)}
        aria-label="Search"
      >
        <Search className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-2xl overflow-hidden p-0">
          <DialogTitle className="sr-only">Search</DialogTitle>
          <DialogDescription className="sr-only">Search documents, tasks and messages</DialogDescription>
          <Command shouldFilter={false} className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]]:px-2">
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder="Search documents, tasks and messages..."
            />
            <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
              {TYPE_OPTIONS.map(({ key, label }) => (
                <Toggle
                  key={key}
                  size="sm"
                  variant="outline"
                  className="h-7 px-3 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                  pressed={types.includes(key)}
                  onPressedChange={(p) => toggleType(key, p)}
                >
                  {label}
                </Toggle>
              ))}
              <Input type="date" aria-label="From date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="h-7 w-36 text-xs" />
              <span className="text-xs text-muted-foreground">to</span>
              <Input type="date" aria-label="To date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="h-7 w-36 text-xs" />
              <Select value={participant} onValueChange={setParticipant}>
                <SelectTrigger className="h-7 w-40 text-xs" aria-label="Participant">
                  <SelectValue placeholder="Anyone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_PEOPLE}>Anyone</SelectItem>
                  {people.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <CommandList className="max-h-96">
              {!loading && !hasResults && visibleCommands.length === 0 && <CommandEmpty>No results found.</CommandEmpty>}

              {visibleCommands.length > 0 && (
                <CommandGroup heading="Commands">
                  {visibleCommands.map((c) => (
                    <CommandItem key={c.id} value={`cmd-${c.id}`} onSelect={() => go(c.run)}>
                      <c.icon className="mr-3 h-4 w-4 shrink-0" />
                      <span className="text-sm">{c.label}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {results && results.documents.length > 0 && (
                <CommandGroup heading={`${prefix}Documents`}>
                  {results.documents.map((d) => (
                    <CommandItem key={d.id} value={`doc-${d.id}`} onSelect={() => go(() => router.push(`/dashboard/documents/${d.id}`))}>
                      <FileText className="mr-3 h-4 w-4 shrink-0" />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{d.title}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {d.snippet ?? [d.teamName, d.authorName].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                      <span className="ml-auto pl-3 text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(d.updatedAt), { addSuffix: true })}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {results && results.tasks.length > 0 && (
                <CommandGroup heading={`${prefix}Tasks`}>
                  {results.tasks.map((t) => (
                    <CommandItem key={t.id} value={`task-${t.id}`} onSelect={() => go(() => router.push("/dashboard/tasks"))}>
                      <CheckSquare className="mr-3 h-4 w-4 shrink-0" />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{t.title}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {t.snippet ?? [EnumLabels.TaskStatus[t.status as keyof typeof EnumLabels.TaskStatus], t.assigneeName && `Assigned to ${t.assigneeName}`].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                      <span className="ml-auto pl-3 text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(t.createdAt), { addSuffix: true })}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {results && results.messages.length > 0 && (
                <CommandGroup heading={`${prefix}Messages`}>
                  {results.messages.map((m) => (
                    <CommandItem
                      key={`${m.kind}-${m.id}`}
                      value={`msg-${m.kind}-${m.id}`}
                      onSelect={() =>
                        go(() => {
                          if (m.kind === "channel" && m.channelId) setActiveChannel(m.channelId)
                          else if (m.contactId) setActiveDirectContact(m.contactId)
                          router.push("/dashboard/messages")
                        })
                      }
                    >
                      {m.kind === "channel" ? <Hash className="mr-3 h-4 w-4 shrink-0" /> : <MessageSquare className="mr-3 h-4 w-4 shrink-0" />}
                      <div className="min-w-0">
                        <div className="truncate text-sm">{m.content}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {m.authorName ?? "Unknown"} · {m.kind === "channel" ? `#${m.channelName}` : "Direct message"}
                        </div>
                      </div>
                      <span className="ml-auto pl-3 text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(m.createdAt), { addSuffix: true })}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  )
}
