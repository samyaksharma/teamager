"use client"

import { CreateOrganizationCard } from "@/components/create-organization-card"
import { InvitationsCard } from "@/components/invitations-card"

// Shown instead of the app's pages to someone who doesn't belong to any workspace yet
export function WorkspaceSetup() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Set up your workspace</h1>
        <p className="mt-2 text-muted-foreground">
          Tasks, documents, messages and members live inside a workspace. Create one for your team, or accept an
          invitation to join an existing one.
        </p>
      </div>
      <InvitationsCard />
      <CreateOrganizationCard />
    </div>
  )
}
