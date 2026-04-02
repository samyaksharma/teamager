"use client"

import type React from "react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Calendar, CheckSquare, FileText, Home, LogOut, Menu, MessageSquare, Settings, Users, UserPlus, X, MoreHorizontal, Bell, Search, Bold, Italic, Underline, Type, List, ListOrdered, Quote, Code } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  SidebarProvider,
  SidebarTrigger,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
} from "@/components/ui/sidebar"
import { useState, useEffect, useRef, useCallback } from "react"
import { ThemeToggle } from "@/components/theme-toggle"
import { TeamagerLogo } from "@/components/teamager-logo"
import { MessagesProvider } from "./messages/messagesContext"
import { useAuth } from "@/lib/authContext"
import { cn } from "@/lib/utils"
// import { AuthGuard } from "@/components/auth-guard"

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  isActive: boolean
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { currentOrganization, logout } = useAuth()
  const pathname = usePathname()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
    window.location.href = '/login'
  }

  const organizationName = currentOrganization?.name || "Teamager"

  // Check if a link is active
  const isActive = (path: string) => {
    return pathname === path || pathname.startsWith(`${path}/`)
  }

  // Check if we're on a document edit page
  const isDocumentEditPage = pathname.includes('/documents/') && pathname !== '/dashboard/documents'

  // Navigation items
  const navItems: NavItem[] = [
    {
      href: "/dashboard",
      label: "Home",
      icon: Home,
      isActive: isActive("/dashboard") && !isActive("/dashboard/tasks") && !isActive("/dashboard/messages") && !isActive("/dashboard/documents") && !isActive("/dashboard/calendar") && !isActive("/dashboard/members")
    },
    {
      href: "/dashboard/tasks",
      label: "Tasks",
      icon: CheckSquare,
      isActive: isActive("/dashboard/tasks")
    },
    {
      href: "/dashboard/calendar",
      label: "Calendar",
      icon: Calendar,
      isActive: isActive("/dashboard/calendar")
    },
    {
      href: "/dashboard/documents",
      label: "Documents",
      icon: FileText,
      isActive: isActive("/dashboard/documents")
    },
    {
      href: "/dashboard/messages",
      label: "Messages",
      icon: MessageSquare,
      isActive: isActive("/dashboard/messages")
    },
    {
      href: "/dashboard/members",
      label: "Members",
      icon: Users,
      isActive: isActive("/dashboard/members")
    }
  ]

  return (
    <MessagesProvider>
      <div className="flex min-h-screen flex-col w-full">
        {/* Top Navigation Header */}
        <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-14 items-center mx-4 justify-between md:justify-start md:gap-4">
            {/* Left: Logo and Brand */}
            <div className="flex items-center gap-2 px-4">
              <Link href="/dashboard" className="flex items-center gap-2 font-bold">
                <TeamagerLogo className="h-6 w-6 flex-shrink-0" />
              </Link>
            </div>

            {/* Center: Main Navigation (Hidden on mobile) */}
            <nav className="hidden md:flex flex-1 items-center justify-center space-x-1">
              {navItems.map((item) => {
                const Icon = item.icon
                return (
                  <Link key={item.href} href={item.href}>
                    <Button
                      variant={item.isActive ? "default" : "ghost"}
                      size="sm"
                      className={cn(
                        "h-9 px-3",
                        item.isActive && "bg-primary text-primary-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4 mr-2" />
                      {item.label}
                    </Button>
                  </Link>
                )
              })}
            </nav>

            {/* Right: Actions and Settings */}
            <div className="flex items-center gap-1 px-0 md:px-4">
              {/* Search - Hidden on mobile */}
              <Button variant="ghost" size="icon" className="h-8 w-8 hidden sm:flex">
                <Search className="h-4 w-4" />
              </Button>

              {/* Desktop Settings Menu - Hidden on mobile */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 hidden md:flex">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <UserPlus className="mr-2 h-4 w-4" />
                    <span>Invite Members</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Logout</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Mobile Right Section */}
              <div className="flex items-center gap-1 md:hidden">
                {/* Notifications */}
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Bell className="h-4 w-4" />
                </Button>

                {/* Theme Toggle */}
                <ThemeToggle />

                {/* Mobile Menu */}
                <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Menu className="h-4 w-4" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                    <nav className="flex flex-col space-y-3">
                      <div className="font-semibold text-lg mb-4">Navigation</div>
                      {navItems.map((item) => {
                        const Icon = item.icon
                        return (
                          <Link key={item.href} href={item.href} onClick={() => setIsMobileMenuOpen(false)}>
                            <Button
                              variant={item.isActive ? "default" : "ghost"}
                              size="sm"
                              className="w-full justify-start h-10"
                            >
                              <Icon className="h-4 w-4 mr-3" />
                              {item.label}
                            </Button>
                          </Link>
                        )
                      })}
                      <div className="pt-4 border-t">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start h-10"
                          onClick={() => {/* Add settings handler */ }}
                        >
                          <Settings className="h-4 w-4 mr-3" />
                          Settings
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start h-10"
                          onClick={() => {/* Add invite handler */ }}
                        >
                          <UserPlus className="h-4 w-4 mr-3" />
                          Invite Members
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start h-10 text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={handleLogout}
                        >
                          <LogOut className="h-4 w-4 mr-3" />
                          Logout
                        </Button>
                      </div>
                    </nav>
                  </SheetContent>
                </Sheet>
              </div>

              {/* Desktop Notifications & Theme - Visible on desktop */}
              <div className="hidden md:flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Bell className="h-4 w-4" />
                </Button>
                <ThemeToggle />
              </div>
            </div>
          </div>

        </header>

        {/* Mobile Toolbar - Sticky under header */}
        {isDocumentEditPage && (
          <div className="sticky top-14 z-40 md:hidden border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <nav className="flex items-center justify-around py-2 px-2">
              <Button
                variant="ghost"
                size="sm"
                className="flex flex-col h-auto py-2 px-2"
                onClick={() => {
                  const event = new CustomEvent('editor-format', { detail: 'bold' })
                  window.dispatchEvent(event)
                }}
              >
                <Bold className="h-4 w-4" />
                <span className="text-xs mt-1">Bold</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="flex flex-col h-auto py-2 px-2"
                onClick={() => {
                  const event = new CustomEvent('editor-format', { detail: 'italic' })
                  window.dispatchEvent(event)
                }}
              >
                <Italic className="h-4 w-4" />
                <span className="text-xs mt-1">Italic</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="flex flex-col h-auto py-2 px-2"
                onClick={() => {
                  const event = new CustomEvent('editor-format', { detail: 'heading1' })
                  window.dispatchEvent(event)
                }}
              >
                <Type className="h-4 w-4" />
                <span className="text-xs mt-1">H1</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="flex flex-col h-auto py-2 px-2"
                onClick={() => {
                  const event = new CustomEvent('editor-format', { detail: 'bulletList' })
                  window.dispatchEvent(event)
                }}
              >
                <List className="h-4 w-4" />
                <span className="text-xs mt-1">List</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="flex flex-col h-auto py-2 px-2"
                onClick={() => {
                  const event = new CustomEvent('editor-format', { detail: 'quote' })
                  window.dispatchEvent(event)
                }}
              >
                <Quote className="h-4 w-4" />
                <span className="text-xs mt-1">Quote</span>
              </Button>
            </nav>
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1">
          {children}
        </main>
      </div>
    </MessagesProvider>
  )
}