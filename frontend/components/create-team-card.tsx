"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Briefcase, Check } from "lucide-react"
import axios from "axios"
import { useRouter } from "next/navigation"

export function CreateTeamCard() {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [teamName, setTeamName] = useState("")
  const [industry, setIndustry] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!teamName.trim()) {
      setError("Team name is required")
      return
    }

    setError("")
    setLoading(true)

    try {
      const response = await axios.post("/api/teams", { 
        name: teamName,
        industry
      })

      setSuccess(true)
      setLoading(false)

      // Redirect to the team page after a short delay
      setTimeout(() => {
        router.push(`/dashboard`)
        router.refresh()
      }, 1000)
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to create team")
      setLoading(false)
    }
  }

  if (success) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center text-center space-y-4 py-6">
            <div className="rounded-full bg-primary/10 p-3">
              <Check className="h-12 w-12 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">Team Created!</h1>
            <p className="text-muted-foreground">
              Your team "{teamName}" has been created successfully. Redirecting...
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Get Started with Teamager</CardTitle>
        <CardDescription>Create a team to start collaborating with others</CardDescription>
      </CardHeader>
      <CardContent>
        {!showForm ? (
          <div className="flex flex-col items-center justify-center py-6 space-y-4">
            <div className="rounded-full bg-primary/10 p-6">
              <Briefcase className="h-12 w-12 text-primary" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-xl font-medium">Create Your Team</h3>
              <p className="text-muted-foreground">
                A team is where you and your colleagues can collaborate on projects and tasks
              </p>
            </div>
            <Button onClick={() => setShowForm(true)} className="mt-4">
              <Plus className="mr-2 h-4 w-4" /> Create a Team
            </Button>
          </div>
        ) : (
          <form onSubmit={handleCreateTeam} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="team-name">Team Name</Label>
              <Input
                id="team-name"
                placeholder="Acme Inc."
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                className={error ? "border-destructive" : ""}
              />
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="industry">Industry (Optional)</Label>
              <Select value={industry} onValueChange={setIndustry}>
                <SelectTrigger id="industry">
                  <SelectValue placeholder="Select industry" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="technology">Technology</SelectItem>
                  <SelectItem value="finance">Finance</SelectItem>
                  <SelectItem value="healthcare">Healthcare</SelectItem>
                  <SelectItem value="education">Education</SelectItem>
                  <SelectItem value="retail">Retail</SelectItem>
                  <SelectItem value="manufacturing">Manufacturing</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex justify-end gap-3 pt-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setShowForm(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Creating..." : "Create Team"}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  )
}