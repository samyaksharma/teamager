"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CalendarSubscribe } from "@/components/calendar-subscribe"
import { useAuth } from "@/lib/authContext"
import { notificationsApi, organizationsApi, teamApi, usersApi } from "@/lib/api"
import { OrganizationRole, TeamRole } from "@/lib/enums"

const SIZES = ["1-10", "11-50", "51-200", "201-500", "501+"]
const INDUSTRIES = ["technology", "finance", "healthcare", "education", "retail", "manufacturing", "other"]
const NONE = "none"

const roleName = (role?: number) =>
  role === OrganizationRole.OWNER ? "Owner" : role === OrganizationRole.ADMIN ? "Admin" : "Member"

function WorkspaceSection() {
  const { currentOrganization, refreshOrganizations } = useAuth()
  const org = currentOrganization
  const canEdit = org?.role === OrganizationRole.OWNER || org?.role === OrganizationRole.ADMIN
  const [name, setName] = useState("")
  const [industry, setIndustry] = useState(NONE)
  const [size, setSize] = useState(NONE)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setName(org?.name ?? "")
    setIndustry(org?.industry || NONE)
    setSize(org?.size || NONE)
  }, [org?.id, org?.name, org?.industry, org?.size])

  if (!org) return <p className="text-sm text-muted-foreground">You aren't part of a workspace yet.</p>

  const dirty = name.trim() !== org.name || (industry === NONE ? "" : industry) !== (org.industry ?? "") || (size === NONE ? "" : size) !== (org.size ?? "")

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      await organizationsApi.updateOrganization(org.id, {
        name: name.trim(),
        industry: industry === NONE ? undefined : industry,
        size: size === NONE ? undefined : size,
      })
      await refreshOrganizations()
      toast.success("Workspace updated")
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to update workspace")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Workspace</CardTitle>
        <CardDescription>
          Your role: <Badge variant="secondary">{roleName(org.role)}</Badge>
          {!canEdit && " Only admins and owners can change workspace settings."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="max-w-md space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ws-name">Workspace name</Label>
            <Input id="ws-name" value={name} onChange={(e) => setName(e.target.value)} disabled={!canEdit} maxLength={255} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ws-industry">Industry</Label>
            <Select value={industry} onValueChange={setIndustry} disabled={!canEdit}>
              <SelectTrigger id="ws-industry"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Not set</SelectItem>
                {INDUSTRIES.map((i) => <SelectItem key={i} value={i} className="capitalize">{i}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ws-size">Company size</Label>
            <Select value={size} onValueChange={setSize} disabled={!canEdit}>
              <SelectTrigger id="ws-size"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Not set</SelectItem>
                {SIZES.map((s) => <SelectItem key={s} value={s}>{s} employees</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {canEdit && <Button type="submit" disabled={saving || !dirty || !name.trim()}>Save changes</Button>}
        </form>
      </CardContent>
    </Card>
  )
}

function TeamsSection() {
  const { teams, currentOrganization, refreshTeams } = useAuth()
  const [names, setNames] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)

  const orgTeams = teams.filter((t) => !currentOrganization || t.organizationId === currentOrganization.id)

  const save = async (teamId: string) => {
    const name = (names[teamId] ?? "").trim()
    if (!name) return
    setSaving(teamId)
    try {
      await teamApi.updateTeam(teamId, { name })
      await refreshTeams()
      setNames((prev) => { const next = { ...prev }; delete next[teamId]; return next })
      toast.success("Team renamed")
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to rename team")
    } finally {
      setSaving(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Teams</CardTitle>
        <CardDescription>
          Rename teams you lead. Manage who is in each team and their roles on the{" "}
          <Link href="/dashboard/members" className="underline">Members page</Link>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {orgTeams.length === 0 && <p className="text-sm text-muted-foreground">No teams yet.</p>}
        {orgTeams.map((team) => {
          const isLead = team.role === TeamRole.LEAD
          const value = names[team.id] ?? team.name
          return (
            <div key={team.id} className="flex items-center gap-2" data-testid={`team-row-${team.name}`}>
              <Input
                aria-label={`Name of team ${team.name}`}
                value={value}
                disabled={!isLead}
                onChange={(e) => setNames((prev) => ({ ...prev, [team.id]: e.target.value }))}
                maxLength={255}
                className="max-w-sm"
              />
              {isLead ? (
                <Button size="sm" variant="outline" onClick={() => save(team.id)} disabled={saving === team.id || value.trim() === team.name || !value.trim()}>
                  Rename
                </Button>
              ) : (
                <Badge variant="outline">{team.role === TeamRole.VIEWER ? "Viewer" : team.role === TeamRole.CONTRIBUTOR ? "Contributor" : "Member"}</Badge>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

function ProfileSection() {
  const { user, setUser } = useAuth()
  const [name, setName] = useState("")
  const [username, setUsername] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setName(user?.name ?? "")
    setUsername(user?.username ?? "")
  }, [user?.id, user?.name, user?.username])

  if (!user) return null
  const dirty = name.trim() !== user.name || username.trim() !== (user.username ?? "")

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const updated = await usersApi.updateProfile({ name: name.trim(), username: username.trim() })
      setUser({ ...user, ...updated })
      toast.success("Profile updated")
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to update profile")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>Your username is what teammates type to @mention you.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="max-w-md space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pf-name">Name</Label>
            <Input id="pf-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pf-username">Username</Label>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">@</span>
              <Input id="pf-username" value={username} onChange={(e) => setUsername(e.target.value)} maxLength={64} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={user.email} disabled />
          </div>
          <Button type="submit" disabled={saving || !dirty || !name.trim() || !username.trim()}>Save profile</Button>
        </form>
      </CardContent>
    </Card>
  )
}

function NotificationsSection() {
  const [settings, setSettings] = useState<{ documents: boolean; tasks: boolean; messages: boolean } | null>(null)

  useEffect(() => {
    notificationsApi.getSettings().then(setSettings).catch(() => toast.error("Failed to load notification settings"))
  }, [])

  const toggle = async (key: "documents" | "tasks" | "messages", value: boolean) => {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev))
    try {
      setSettings(await notificationsApi.updateSettings({ [key]: value }))
    } catch {
      setSettings((prev) => (prev ? { ...prev, [key]: !value } : prev))
      toast.error("Failed to update notification settings")
    }
  }

  const rows: { key: "documents" | "tasks" | "messages"; label: string; hint: string }[] = [
    { key: "messages", label: "Messages", hint: "Direct messages, mentions, replies and reactions" },
    { key: "tasks", label: "Tasks", hint: "Assignments and sub-items" },
    { key: "documents", label: "Documents", hint: "Shares, comments and suggestions" },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>Choose which activity shows up in your notification feed.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.map(({ key, label, hint }) => (
          <div key={key} className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium">{label}</div>
              <div className="text-xs text-muted-foreground">{hint}</div>
            </div>
            <Switch checked={settings?.[key] ?? true} disabled={!settings} onCheckedChange={(v) => toggle(key, v)} aria-label={`${label} notifications`} />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function IntegrationsSection() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Calendar</CardTitle>
          <CardDescription>Subscribe to your due dates from Google Calendar, Outlook or Apple Calendar.</CardDescription>
        </CardHeader>
        <CardContent><CalendarSubscribe /></CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Git and file storage</CardTitle>
          <CardDescription>
            Paste a GitHub or GitLab pull request, commit or issue, or a Google Drive or Dropbox link, into a task's
            Links section. They're recognised and labelled automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" size="sm"><Link href="/dashboard/tasks">Go to tasks</Link></Button>
        </CardContent>
      </Card>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-4 md:p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your workspace, teams and personal preferences.</p>
      </div>
      <Tabs defaultValue="workspace" className="space-y-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="workspace">Workspace</TabsTrigger>
          <TabsTrigger value="teams">Teams</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
        </TabsList>
        <TabsContent value="workspace"><WorkspaceSection /></TabsContent>
        <TabsContent value="teams"><TeamsSection /></TabsContent>
        <TabsContent value="profile"><ProfileSection /></TabsContent>
        <TabsContent value="notifications"><NotificationsSection /></TabsContent>
        <TabsContent value="integrations"><IntegrationsSection /></TabsContent>
      </Tabs>
    </div>
  )
}
