"use client"

import { useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Building2, Check, ChevronsUpDown, Plus } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { CreateOrganizationCard } from "@/components/create-organization-card"
import { useAuth } from "@/lib/authContext"
import { OrganizationRole } from "@/lib/enums"

const roleLabel = (role?: number) =>
  role === OrganizationRole.OWNER ? "Owner" : role === OrganizationRole.ADMIN ? "Admin" : "Member"

// Shows the organizations the user belongs to and switches the one the app is showing
export function OrganizationSwitcher() {
  const { organizations, currentOrganization, setCurrentOrganization } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [createOpen, setCreateOpen] = useState(false)

  if (!currentOrganization) return null

  const select = (id: string) => {
    if (id === currentOrganization.id) return
    const next = organizations.find((o) => o.id === id)
    if (!next) return
    setCurrentOrganization(next)
    // A document open in the previous organization isn't part of this one
    if (/^\/dashboard\/documents\/.+/.test(pathname)) router.push("/dashboard/documents")
  }

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-9 max-w-[11rem] gap-2 px-2" aria-label="Switch organization">
            <Building2 className="h-4 w-4 shrink-0" />
            <span className="truncate text-sm font-medium" data-testid="current-organization">{currentOrganization.name}</span>
            <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Your organizations ({organizations.length})
          </DropdownMenuLabel>
          {organizations.map((org) => (
            <DropdownMenuItem key={org.id} onSelect={() => select(org.id)} className="gap-2" data-testid={`org-option-${org.name}`}>
              <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{org.name}</span>
              <Badge variant="outline" className="shrink-0 text-[10px]">{roleLabel(org.role)}</Badge>
              {org.id === currentOrganization.id && <Check className="h-4 w-4 shrink-0" aria-label="Current organization" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Create new organization
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New organization</DialogTitle>
            <DialogDescription>It gets its own teams, tasks, documents and members.</DialogDescription>
          </DialogHeader>
          <CreateOrganizationCard onCreated={() => setCreateOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  )
}
