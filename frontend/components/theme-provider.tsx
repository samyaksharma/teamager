"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"
import type { ThemeProviderProps } from "next-themes"

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  React.useEffect(() => {
    const savedVariant = localStorage.getItem("theme-variant")
    if (savedVariant && savedVariant !== "default") {
      document.documentElement.classList.add(`theme-${savedVariant}`)
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    console.log('System prefers dark mode:', mediaQuery.matches)
    
    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
      console.log('System theme changed to:', e.matches ? 'dark' : 'light')
    }
    
    mediaQuery.addEventListener('change', handleSystemThemeChange)
    return () => mediaQuery.removeEventListener('change', handleSystemThemeChange)
  }, [])

  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
