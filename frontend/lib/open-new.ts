import { useEffect } from "react"

// Lets the command palette ask a page to open its "create" dialog, whether the page is already
// mounted (event) or is about to be (flag read on mount).
const EVENT = "teamager:open-new"
const FLAG = "teamager:open-new"

export type NewKind = "task" | "document"

export function requestOpenNew(kind: NewKind) {
  try {
    sessionStorage.setItem(FLAG, kind)
  } catch {
    // sessionStorage can be unavailable; the event below still covers an already-mounted page
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: kind }))
}

export function useOpenNew(kind: NewKind, open: () => void) {
  useEffect(() => {
    const consume = () => {
      try {
        if (sessionStorage.getItem(FLAG) === kind) {
          sessionStorage.removeItem(FLAG)
          open()
        }
      } catch {
        // ignore
      }
    }
    consume()
    const onEvent = (e: Event) => {
      if ((e as CustomEvent).detail === kind) consume()
    }
    window.addEventListener(EVENT, onEvent)
    return () => window.removeEventListener(EVENT, onEvent)
    // `open` only calls a state setter
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind])
}
