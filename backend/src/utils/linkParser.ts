export type LinkProvider = 'github' | 'gitlab' | 'gdrive' | 'dropbox' | 'other'
export type LinkKind = 'pull_request' | 'issue' | 'commit' | 'branch' | 'repo' | 'file' | 'link'

export interface ParsedLink {
  url: string
  provider: LinkProvider
  kind: LinkKind
  label: string
}

const short = (sha: string) => sha.slice(0, 7)

// Recognise git hosting and file-storage URLs and give them a readable label. Only http(s) is accepted.
export function parseLink(input: string): ParsedLink | null {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null

  const host = url.hostname.toLowerCase().replace(/^www\./, '')
  const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent)
  const clean = url.toString()

  // GitHub: /owner/repo[/pull/N | /issues/N | /commit/SHA | /tree/BRANCH]
  if (host === 'github.com' && parts.length >= 2) {
    const [owner, repo, section, ref, ...rest] = parts
    const base = `${owner}/${repo}`
    if (section === 'pull' && /^\d+$/.test(ref ?? '')) return { url: clean, provider: 'github', kind: 'pull_request', label: `${base}#${ref}` }
    if (section === 'issues' && /^\d+$/.test(ref ?? '')) return { url: clean, provider: 'github', kind: 'issue', label: `${base}#${ref}` }
    if (section === 'commit' && ref) return { url: clean, provider: 'github', kind: 'commit', label: `${base}@${short(ref)}` }
    if (section === 'tree' && ref) return { url: clean, provider: 'github', kind: 'branch', label: `${base}:${[ref, ...rest].join('/')}` }
    return { url: clean, provider: 'github', kind: 'repo', label: base }
  }

  // GitLab (gitlab.com or a self-hosted host with "gitlab" in its name): /group/.../repo/-/merge_requests/N ...
  if ((host === 'gitlab.com' || host.includes('gitlab')) && parts.length >= 2) {
    const dash = parts.indexOf('-')
    const projectParts = dash === -1 ? parts : parts.slice(0, dash)
    const project = projectParts.join('/')
    if (dash !== -1) {
      const [section, ref, ...rest] = parts.slice(dash + 1)
      if (section === 'merge_requests' && /^\d+$/.test(ref ?? '')) return { url: clean, provider: 'gitlab', kind: 'pull_request', label: `${project}!${ref}` }
      if (section === 'issues' && /^\d+$/.test(ref ?? '')) return { url: clean, provider: 'gitlab', kind: 'issue', label: `${project}#${ref}` }
      if ((section === 'commit' || section === 'commits') && ref) return { url: clean, provider: 'gitlab', kind: 'commit', label: `${project}@${short(ref)}` }
      if (section === 'tree' && ref) return { url: clean, provider: 'gitlab', kind: 'branch', label: `${project}:${[ref, ...rest].join('/')}` }
    }
    return { url: clean, provider: 'gitlab', kind: 'repo', label: project }
  }

  if (host === 'drive.google.com' || host === 'docs.google.com') {
    return { url: clean, provider: 'gdrive', kind: 'file', label: host === 'docs.google.com' ? 'Google Doc' : 'Google Drive file' }
  }
  if (host === 'dropbox.com' || host.endsWith('.dropbox.com')) {
    const name = parts[parts.length - 1]
    return { url: clean, provider: 'dropbox', kind: 'file', label: name ? `Dropbox: ${name}` : 'Dropbox file' }
  }

  return { url: clean, provider: 'other', kind: 'link', label: host + (url.pathname !== '/' ? url.pathname : '') }
}
