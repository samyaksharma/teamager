import { eq } from 'drizzle-orm'
import { db, notifications, notificationSettings } from '../db'

export type NotificationModule = 'documents' | 'tasks' | 'messages'

interface NotifyInput {
  userId: string
  actorId: string
  module: NotificationModule
  type: string
  title: string
  body?: string | null
  link?: string
}

const preview = (text: string) => (text.length > 120 ? `${text.slice(0, 117)}...` : text)

// Creates an in-app notification. Never throws: a notification failure must not break the action that caused it.
export async function notify(input: NotifyInput) {
  try {
    // Don't notify people about their own actions
    if (input.userId === input.actorId) return

    const settings = await db.select().from(notificationSettings)
      .where(eq(notificationSettings.userId, input.userId)).limit(1)
    if (settings[0] && settings[0][input.module] === false) return

    await db.insert(notifications).values({
      userId: input.userId,
      actorId: input.actorId,
      module: input.module,
      type: input.type,
      title: input.title,
      body: input.body ? preview(input.body) : null,
      link: input.link
    })
  } catch (error) {
    console.error('Failed to create notification:', error)
  }
}
