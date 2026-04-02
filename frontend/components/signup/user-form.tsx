"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Eye, EyeOff } from "lucide-react"
import axios from "axios"

interface UserData {
  name: string
  username: string
  email: string
  password: string
}

interface UserFormProps {
  initialData: UserData
  onSubmit: (data: UserData) => void
  onBack?: () => void
}

export function UserForm({ initialData, onSubmit, onBack }: UserFormProps) {
  const [formData, setFormData] = useState<UserData>(initialData)
  const [errors, setErrors] = useState<Partial<Record<keyof UserData, string>>>({})
  const [showPassword, setShowPassword] = useState(false)
  const [usernameChecking, setUsernameChecking] = useState(false)
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null)

  // Auto-generate username when email changes
  useEffect(() => {
    if (formData.email && !formData.username) {
      const suggestedUsername = formData.email.split('@')[0].toLowerCase()
      setFormData(prev => ({ ...prev, username: suggestedUsername }))
    }
  }, [formData.email, formData.username])

  // Check username availability with debounce
  useEffect(() => {
    // Reset validation state immediately when username changes
    setUsernameAvailable(null)
    setUsernameChecking(false)
    
    // Clear username errors when user starts typing a new username
    if (errors.username) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors.username
        return newErrors
      })
    }
    
    if (!formData.username || formData.username.length < 3) {
      return
    }

    const timeoutId = setTimeout(async () => {
      setUsernameChecking(true)
      try {
        const API_URL = 'http://localhost:3001'
        const response = await axios.get(`${API_URL}/api/auth/check-username?username=${formData.username}`)
        setUsernameAvailable(!response.data.exists)
        
        // Clear username error if username becomes available
        if (!response.data.exists && errors.username) {
          setErrors(prev => {
            const newErrors = { ...prev }
            delete newErrors.username
            return newErrors
          })
        }
      } catch (error) {
        setUsernameAvailable(null)
      } finally {
        setUsernameChecking(false)
      }
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [formData.username, errors.username])

  // Clear errors when fields are corrected
  useEffect(() => {
    if (errors.name && formData.name.trim().length >= 2) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors.name
        return newErrors
      })
    }
  }, [formData.name, errors.name])

  useEffect(() => {
    if (errors.email && formData.email.trim() && /\S+@\S+\.\S+/.test(formData.email)) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors.email
        return newErrors
      })
    }
  }, [formData.email, errors.email])

  useEffect(() => {
    if (errors.password && formData.password.length >= 8) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors.password
        return newErrors
      })
    }
  }, [formData.password, errors.password])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Validate form
    const newErrors: Partial<Record<keyof UserData, string>> = {}

    if (!formData.name.trim()) {
      newErrors.name = "Full name is required"
    } else if (formData.name.trim().length < 2) {
      newErrors.name = "Name must be at least 2 characters"
    }

    if (!formData.username.trim()) {
      newErrors.username = "Username is required"
    } else if (formData.username.length < 3) {
      newErrors.username = "Username must be at least 3 characters"
    } else if (formData.username.length > 30) {
      newErrors.username = "Username must be less than 30 characters"
    } else if (!/^[a-zA-Z0-9._-]+$/.test(formData.username)) {
      newErrors.username = "Username can only contain letters, numbers, dots, underscores, and hyphens"
    } else if (usernameChecking) {
      newErrors.username = "Please wait while we check username availability"
    } else if (usernameAvailable === false) {
      newErrors.username = "This username is already taken. Please choose a different one."
    } else if (usernameAvailable === null && formData.username.length >= 3) {
      newErrors.username = "Unable to verify username availability. Please try again."
    }

    if (!formData.email.trim()) {
      newErrors.email = "Email is required"
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address"
    } else if (formData.email.length > 254) {
      newErrors.email = "Email address is too long"
    }

    if (!formData.password) {
      newErrors.password = "Password is required"
    } else if (formData.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters"
    } else if (formData.password.length > 128) {
      newErrors.password = "Password must be less than 128 characters"
    } else if (!/(?=.*[a-z])(?=.*[A-Z])|(?=.*[a-z])(?=.*[0-9])|(?=.*[A-Z])(?=.*[0-9])/.test(formData.password)) {
      newErrors.password = "Password must contain at least two of: lowercase letter, uppercase letter, or number"
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    // Clear any previous errors
    setErrors({})

    // Submit form if validation passes
    onSubmit(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold">Create your account</h1>
        <p className="text-muted-foreground">Enter your information to get started</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="full-name">Full name</Label>
          <Input
            id="full-name"
            placeholder="John Doe"
            autoComplete="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className={errors.name ? "border-destructive" : ""}
          />
          {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <div className="relative">
            <Input
              id="username"
              placeholder="john_doe"
              autoComplete="username"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase() })}
              className={errors.username ? "border-destructive" : usernameAvailable === true ? "border-green-500" : usernameAvailable === false ? "border-red-500" : ""}
            />
            {usernameChecking && <span className="absolute right-3 top-3 text-xs text-muted-foreground">Checking...</span>}
            {!usernameChecking && usernameAvailable === true && <span className="absolute right-3 top-3 text-xs text-green-600">✓ Available</span>}
            {!usernameChecking && usernameAvailable === false && <span className="absolute right-3 top-3 text-xs text-red-600">✗ Taken</span>}
          </div>
          {errors.username && <p className="text-xs text-destructive">{errors.username}</p>}
          <p className="text-xs text-muted-foreground">This will be your unique username on Teamager</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            type="email"
            placeholder="john@example.com"
            autoComplete="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            className={errors.email ? "border-destructive" : ""}
          />
          {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              autoComplete="new-password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className={errors.password ? "border-destructive pr-10" : "pr-10"}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-full px-3"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              <span className="sr-only">{showPassword ? "Hide password" : "Show password"}</span>
            </Button>
          </div>
          {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
          <p className="text-xs text-muted-foreground">Password must be at least 8 characters long</p>
        </div>
      </div>

      <div className="flex gap-3">
        {onBack && (
          <Button type="button" variant="outline" onClick={onBack} className="flex-1">
            Back
          </Button>
        )}
        <Button type="submit" className="flex-1">
          Continue
        </Button>
      </div>
    </form>
  )
}
