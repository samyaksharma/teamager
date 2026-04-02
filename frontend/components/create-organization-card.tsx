"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Building2, Check } from "lucide-react"
import { organizationsApi } from "@/lib/api"
import { useRouter } from "next/navigation"

export function CreateOrganizationCard() {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [orgName, setOrgName] = useState("")
  const [industry, setIndustry] = useState("")
  const [size, setSize] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!orgName.trim()) {
      setError("Organization name is required")
      return
    }

    setError("")
    setLoading(true)

    try {
      // Use the organizationsApi to create the organization
      const response = await organizationsApi.createOrganization({ 
        name: orgName,
        industry,
        size
      });

      // Store the organization name for the success message
      const orgData = response.organization || { name: orgName };
      
      setSuccess(true)
      setLoading(false)

      // Redirect to the dashboard after a short delay
      setTimeout(() => {
        router.push(`/dashboard`)
        router.refresh()
      }, 1500)
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to create organization")
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
            <h1 className="text-2xl font-bold">Organization Created!</h1>
            <p className="text-muted-foreground">
              Your organization "{orgName}" has been created successfully with a default team. Redirecting to your dashboard...
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
        <CardDescription>Create an organization to start collaborating with others</CardDescription>
      </CardHeader>
      <CardContent>
        {!showForm ? (
          <div className="flex flex-col items-center justify-center py-6 space-y-4">
            <div className="rounded-full bg-primary/10 p-6">
              <Building2 className="h-12 w-12 text-primary" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-xl font-medium">Create Your Organization</h3>
              <p className="text-muted-foreground">
                An organization is where you and your colleagues can collaborate across multiple teams
              </p>
            </div>
            <Button onClick={() => setShowForm(true)} className="mt-4">
              <Plus className="mr-2 h-4 w-4" /> Create an Organization
            </Button>
          </div>
        ) : (
          <form onSubmit={handleCreateOrganization} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="org-name">Organization Name</Label>
              <Input
                id="org-name"
                placeholder="Acme Inc."
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className={error ? "border-destructive" : ""}
              />
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="industry">Industry</Label>
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

            <div className="space-y-2">
              <Label htmlFor="size">Organization Size</Label>
              <Select value={size} onValueChange={setSize}>
                <SelectTrigger id="size">
                  <SelectValue placeholder="Select organization size" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1-10">1-10 employees</SelectItem>
                  <SelectItem value="11-50">11-50 employees</SelectItem>
                  <SelectItem value="51-200">51-200 employees</SelectItem>
                  <SelectItem value="201-500">201-500 employees</SelectItem>
                  <SelectItem value="501+">501+ employees</SelectItem>
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
                {loading ? "Creating..." : "Create Organization"}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  )
}