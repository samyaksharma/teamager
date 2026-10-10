// Allowlist sanitizer for previewing stored document HTML (written by collaborators) outside the editor.
const ALLOWED_TAGS = new Set([
  "p", "br", "hr", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "blockquote", "pre", "code",
  "strong", "b", "em", "i", "u", "s", "mark", "span", "a", "table", "thead", "tbody", "tr", "th", "td", "img",
])
// Content of these is dropped entirely rather than unwrapped
const DROP_WITH_CONTENT = new Set(["script", "style", "iframe", "object", "embed", "noscript", "template"])
const SAFE_STYLE = /^(color|background-color)\s*:\s*(#[0-9a-f]{3,8}|rgba?\([\d\s,.%]+\)|[a-z]+)\s*;?$/i

function isSafeUrl(value: string, allowData: boolean) {
  const v = value.trim().toLowerCase()
  return v.startsWith("http://") || v.startsWith("https://") || v.startsWith("mailto:") || v.startsWith("/") ||
    (allowData && v.startsWith("data:image/") && !v.startsWith("data:image/svg"))
}

export function sanitizeHtml(html: string): string {
  if (typeof window === "undefined") return ""
  const doc = new DOMParser().parseFromString(html, "text/html")

  const clean = (node: Node): Node | null => {
    if (node.nodeType === Node.TEXT_NODE) return node.cloneNode(true)
    if (node.nodeType !== Node.ELEMENT_NODE) return null

    const el = node as Element
    const tag = el.tagName.toLowerCase()
    if (DROP_WITH_CONTENT.has(tag)) return null

    const fragment = document.createDocumentFragment()
    for (const child of Array.from(el.childNodes)) {
      const cleaned = clean(child)
      if (cleaned) fragment.appendChild(cleaned)
    }
    if (!ALLOWED_TAGS.has(tag)) return fragment // unwrap unknown elements, keep their text

    const out = document.createElement(tag)
    if (tag === "a") {
      const href = el.getAttribute("href")
      if (href && isSafeUrl(href, false)) {
        out.setAttribute("href", href)
        out.setAttribute("rel", "noopener noreferrer nofollow")
        out.setAttribute("target", "_blank")
      }
    } else if (tag === "img") {
      const src = el.getAttribute("src")
      if (!src || !isSafeUrl(src, true)) return null
      out.setAttribute("src", src)
      out.setAttribute("alt", el.getAttribute("alt") ?? "")
    }
    const style = el.getAttribute("style")
    if (style) {
      const safe = style.split(";").map((s) => s.trim()).filter((s) => SAFE_STYLE.test(s))
      if (safe.length) out.setAttribute("style", safe.join("; "))
    }
    out.appendChild(fragment)
    return out
  }

  const container = document.createElement("div")
  for (const child of Array.from(doc.body.childNodes)) {
    const cleaned = clean(child)
    if (cleaned) container.appendChild(cleaned)
  }
  return container.innerHTML
}
