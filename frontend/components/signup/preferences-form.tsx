"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"

interface PreferencesData {
  organizationRole: string
  department: string
  jobTitle: string
  notifications: boolean
  termsAccepted: boolean
}

interface PreferencesFormProps {
  initialData: PreferencesData
  onSubmit: (data: PreferencesData) => void
  onBack: () => void
}

export function PreferencesForm({ initialData, onSubmit, onBack }: PreferencesFormProps) {
  const [formData, setFormData] = useState<PreferencesData>(initialData)
  const [errors, setErrors] = useState<Partial<Record<keyof PreferencesData, string>>>({})

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Validate form
    const newErrors: Partial<Record<keyof PreferencesData, string>> = {}

    if (!formData.organizationRole.trim()) {
      newErrors.organizationRole = "Organization role is required"
    }

    if (!formData.department) {
      newErrors.department = "Department is required"
    }

    if (!formData.termsAccepted) {
      newErrors.termsAccepted = "You must accept the terms and conditions"
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    // Submit form if validation passes
    onSubmit(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold">Almost there!</h1>
        <p className="text-muted-foreground">Tell us a bit more about yourself</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="organizationRole">Your role in the organization</Label>
          <Select
            value={formData.organizationRole}
            onValueChange={(value) => setFormData({ ...formData, organizationRole: value })}
          >
            <SelectTrigger id="organizationRole" className={errors.organizationRole ? "border-destructive" : ""}>
              <SelectValue placeholder="Select your role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="owner">Owner</SelectItem>
              <SelectItem value="admin">Administrator</SelectItem>
              <SelectItem value="member">Member</SelectItem>
            </SelectContent>
          </Select>
          {errors.organizationRole && <p className="text-xs text-destructive">{errors.organizationRole}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="jobTitle">Job Title</Label>
          <Input
            id="jobTitle"
            placeholder="Product Manager"
            value={formData.jobTitle}
            onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="department">Department</Label>
          <Select
            value={formData.department}
            onValueChange={(value) => setFormData({ ...formData, department: value })}
          >
            <SelectTrigger id="department" className={errors.department ? "border-destructive" : ""}>
              <SelectValue placeholder="Select department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="engineering">Engineering</SelectItem>
              <SelectItem value="product">Product</SelectItem>
              <SelectItem value="design">Design</SelectItem>
              <SelectItem value="marketing">Marketing</SelectItem>
              <SelectItem value="sales">Sales</SelectItem>
              <SelectItem value="support">Customer Support</SelectItem>
              <SelectItem value="hr">Human Resources</SelectItem>
              <SelectItem value="finance">Finance</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
          {errors.department && <p className="text-xs text-destructive">{errors.department}</p>}
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="notifications"
            checked={formData.notifications}
            onCheckedChange={(checked) => setFormData({ ...formData, notifications: checked === true })}
          />
          <Label htmlFor="notifications" className="text-sm font-normal">
            Receive product updates and notifications
          </Label>
        </div>

        <div className="flex items-start space-x-2">
          <Checkbox
            id="terms"
            checked={formData.termsAccepted}
            onCheckedChange={(checked) => setFormData({ ...formData, termsAccepted: checked === true })}
            className={errors.termsAccepted ? "border-destructive" : ""}
          />
          <div className="grid gap-1.5 leading-none">
            <Label htmlFor="terms" className="text-sm font-normal">
              I agree to the{" "}
              <a href="#" className="text-primary hover:underline">
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="#" className="text-primary hover:underline">
                Privacy Policy
              </a>
            </Label>
            {errors.termsAccepted && <p className="text-xs text-destructive">{errors.termsAccepted}</p>}
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onBack} className="flex-1">
          Back
        </Button>
        <Button type="submit" className="flex-1">
          Complete Setup
        </Button>
      </div>
    </form>
  )
}
