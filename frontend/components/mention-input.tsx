"use client"

import { useMemo, useRef, useState } from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"

export interface MentionPerson {
  id: string
  name: string
  username?: string
}

interface MentionInputProps extends Omit<React.ComponentProps<typeof Input>, "onChange" | "value"> {
  value: string
  onChange: (value: string) => void
  people: MentionPerson[]
}

// The "@word" being typed right before the caret, if any
const ACTIVE_MENTION = /(?:^|\s)@([A-Za-z0-9_.-]*)$/

// A text input that suggests teammates when you type "@" and inserts their @username
export function MentionInput({ value, onChange, people, className, ...props }: MentionInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [caret, setCaret] = useState(0)
  const [highlight, setHighlight] = useState(0)
  const [dismissedAt, setDismissedAt] = useState<number | null>(null)

  const query = useMemo(() => {
    const match = ACTIVE_MENTION.exec(value.slice(0, caret))
    return match ? match[1] : null
  }, [value, caret])

  const suggestions = useMemo(() => {
    if (query === null || dismissedAt === caret) return []
    const q = query.toLowerCase()
    return people
      .filter((p) => p.username && (p.username.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)))
      .slice(0, 6)
  }, [people, query, dismissedAt, caret])

  const open = suggestions.length > 0

  const choose = (person: MentionPerson) => {
    const before = value.slice(0, caret)
    const start = before.lastIndexOf("@")
    const inserted = `@${person.username} `
    const next = value.slice(0, start) + inserted + value.slice(caret)
    onChange(next)
    const position = start + inserted.length
    setHighlight(0)
    requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.setSelectionRange(position, position)
      setCaret(position)
    })
  }

  return (
    <div className="relative flex-1">
      <Input
        {...props}
        ref={inputRef}
        value={value}
        className={className}
        autoComplete="off"
        onChange={(e) => {
          onChange(e.target.value)
          setCaret(e.target.selectionStart ?? e.target.value.length)
          setHighlight(0)
          setDismissedAt(null)
        }}
        onSelect={(e) => setCaret(e.currentTarget.selectionStart ?? 0)}
        onKeyDown={(e) => {
          if (!open) return
          if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((h) => (h + 1) % suggestions.length) }
          else if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length) }
          else if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); choose(suggestions[highlight]) }
          else if (e.key === "Escape") { e.preventDefault(); setDismissedAt(caret) }
        }}
        aria-autocomplete="list"
        aria-expanded={open}
      />
      {open && (
        <ul role="listbox" aria-label="Mention suggestions" className="absolute bottom-full left-0 z-50 mb-1 w-64 overflow-hidden rounded-md border bg-popover shadow-md">
          {suggestions.map((p, i) => (
            <li key={p.id} role="option" aria-selected={i === highlight}>
              <button
                type="button"
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${i === highlight ? "bg-accent" : "hover:bg-accent/60"}`}
                onMouseDown={(e) => { e.preventDefault(); choose(p) }}
              >
                <Avatar className="h-6 w-6"><AvatarFallback>{p.name.slice(0, 1)}</AvatarFallback></Avatar>
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                <span className="text-xs text-muted-foreground">@{p.username}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
