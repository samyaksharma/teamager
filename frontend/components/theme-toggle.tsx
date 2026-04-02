"use client"

import { useState, useEffect } from "react"
import { Moon, Sun, Monitor } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function ThemeToggle() {
  const { setTheme, theme, resolvedTheme, systemTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Only show the theme toggle on the client to avoid hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  // Debug logging and system theme fix
  useEffect(() => {
    if (mounted) {
      console.log('Theme debug:', { theme, resolvedTheme, systemTheme })
      
      // Check if we need to force system theme refresh
      if (theme === "system") {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
        const systemIsDark = mediaQuery.matches
        const htmlElement = document.documentElement
        
        console.log('System is dark:', systemIsDark)
        console.log('HTML has dark class:', htmlElement.classList.contains('dark'))
        
        // Force apply the correct system theme if there's a mismatch
        if (systemIsDark && !htmlElement.classList.contains('dark')) {
          console.log('Forcing dark mode application')
          htmlElement.classList.add('dark')
        } else if (!systemIsDark && htmlElement.classList.contains('dark')) {
          console.log('Forcing light mode application')
          htmlElement.classList.remove('dark')
        }
      }
    }
  }, [mounted, theme, resolvedTheme, systemTheme])

  if (!mounted) {
    return null
  }

  // Always show sun/moon icons based on resolved theme
  const getIcon = () => {
    return (
      <>
        <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      </>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 md:h-9 md:w-9">
          {getIcon()}
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem 
          onClick={() => setTheme("light")}
          className={theme === "light" ? "bg-accent" : ""}
        >
          <Sun className="mr-2 h-4 w-4" />
          <span>Light</span>
          {theme === "light" && <span className="ml-auto text-xs">✓</span>}
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => setTheme("dark")}
          className={theme === "dark" ? "bg-accent" : ""}
        >
          <Moon className="mr-2 h-4 w-4" />
          <span>Dark</span>
          {theme === "dark" && <span className="ml-auto text-xs">✓</span>}
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => {
            // Clear any cached theme data and force system refresh
            localStorage.removeItem('teamager-theme')
            setTheme("system")
            setTimeout(() => {
              // Force a page refresh to ensure clean theme state
              const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
              const htmlElement = document.documentElement
              if (mediaQuery.matches) {
                htmlElement.classList.add('dark')
              } else {
                htmlElement.classList.remove('dark')
              }
            }, 100)
          }}
          className={theme === "system" ? "bg-accent" : ""}
        >
          <Monitor className="mr-2 h-4 w-4" />
          <div className="flex flex-col">
            <span>System</span>
            {theme === "system" && (
              <span className="text-xs text-muted-foreground">
                Currently {systemTheme || resolvedTheme}
              </span>
            )}
          </div>
          {theme === "system" && <span className="ml-auto text-xs">✓</span>}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}