"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"
import type { ThemeProviderProps } from "next-themes"

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  // Clear any conflicting theme storage on mount to ensure clean state
  React.useEffect(() => {
    // Apply saved theme variant on mount
    const savedVariant = localStorage.getItem("theme-variant")
    if (savedVariant && savedVariant !== "default") {
      document.documentElement.classList.add(`theme-${savedVariant}`)
    }

    // Debug: Log system preference detection
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    console.log('System prefers dark mode:', mediaQuery.matches)
    
    // Listen for system theme changes
    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
      console.log('System theme changed to:', e.matches ? 'dark' : 'light')
    }
    
    mediaQuery.addEventListener('change', handleSystemThemeChange)
    return () => mediaQuery.removeEventListener('change', handleSystemThemeChange)
  }, [])

  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
