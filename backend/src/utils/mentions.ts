// @username tokens in message text. A mention must not be glued to a preceding word (so emails don't count),
// and trailing punctuation such as "." in "thanks @bob." is not part of the name.
const MENTION = /(?<![\w@])@([A-Za-z0-9_]+(?:[.-][A-Za-z0-9_]+)*)/g

export function extractMentionUsernames(content: string): string[] {
  const found = new Set<string>()
  for (const match of content.matchAll(MENTION)) {
    found.add(match[1].toLowerCase())
    if (found.size >= 20) break
  }
  return [...found]
}
