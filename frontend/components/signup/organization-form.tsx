"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface OrganizationData {
  name: string
  size: string
  industry: string
}

interface OrganizationFormProps {
  initialData: OrganizationData
  onSubmit: (data: OrganizationData) => void
}

export function OrganizationForm({ initialData, onSubmit }: OrganizationFormProps) {
  const [formData, setFormData] = useState<OrganizationData>(initialData)
  const [errors, setErrors] = useState<Partial<Record<keyof OrganizationData, string>>>({})

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Only validate if all fields aren't empty (if user is trying to create an organization)
    if (formData.name.trim() || formData.size || formData.industry) {
      // Validate form
      const newErrors: Partial<Record<keyof OrganizationData, string>> = {}

      if (!formData.name.trim()) {
        newErrors.name = "Organization name is required"
      }

      if (!formData.size) {
        newErrors.size = "Organization size is required"
      }

      if (!formData.industry) {
        newErrors.industry = "Industry is required"
      }

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors)
        return
      }
    }

    // Submit form if validation passes
    onSubmit(formData)
  }

  // Skip organization creation
  const handleSkip = () => {
    // Submit empty organization data
    onSubmit({
      name: "",
      size: "",
      industry: ""
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold">Create your workspace</h1>
        <p className="text-muted-foreground">Tell us about your organization (optional)</p>
        <p className="text-xs text-muted-foreground">
          You can skip this step if you're joining an existing organization or want to create one later.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="org-name">Organization name</Label>
          <Input
            id="org-name"
            placeholder="Acme Inc."
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className={errors.name ? "border-destructive" : ""}
          />
          {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="org-size">Organization size</Label>
          <Select value={formData.size} onValueChange={(value) => setFormData({ ...formData, size: value })}>
            <SelectTrigger id="org-size" className={errors.size ? "border-destructive" : ""}>
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
          {errors.size && <p className="text-xs text-destructive">{errors.size}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="industry">Industry</Label>
          <Select value={formData.industry} onValueChange={(value) => setFormData({ ...formData, industry: value })}>
            <SelectTrigger id="industry" className={errors.industry ? "border-destructive" : ""}>
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
          {errors.industry && <p className="text-xs text-destructive">{errors.industry}</p>}
        </div>
      </div>

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={handleSkip} className="flex-1">
          Skip for Now
        </Button>
        <Button type="submit" className="flex-1">
          Continue
        </Button>
      </div>
      <p className="text-xs text-center text-muted-foreground">
        You can join or create an organization later if you skip now.
      </p>
    </form>
  )
}
