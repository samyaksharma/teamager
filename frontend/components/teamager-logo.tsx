"use client"

import { useTheme } from "next-themes"
import { useEffect, useState } from "react"

interface TeamagerLogoProps {
  className?: string
  alt?: string
}

export function TeamagerLogo({ className = "h-6 w-6", alt = "Teamager" }: TeamagerLogoProps) {
  const { theme, systemTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    // Return default logo during SSR to prevent hydration mismatch
    return <img src="/teamager.svg" alt={alt} className={className} />
  }

  const currentTheme = theme === "system" ? systemTheme : theme
  const logoSrc = currentTheme === "dark" ? "/teamager-dark.svg" : "/teamager.svg"

  return <img src={logoSrc} alt={alt} className={className} />
}