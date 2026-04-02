"use client"

import { Button } from "@/components/ui/button"
import { PanelLeft, X } from "lucide-react"
import { useState, useEffect } from "react"

interface SidebarToggleProps {
  onToggle: () => void
  isOpen: boolean
}

export function SidebarToggle({ onToggle, isOpen }: SidebarToggleProps) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="md:hidden"
      onClick={onToggle}
      aria-label={isOpen ? "Close sidebar" : "Open sidebar"}
    >
      {isOpen ? <X className="h-5 w-5" /> : <PanelLeft className="h-5 w-5" />}
    </Button>
  )
}

export function useSidebar() {
  const [isOpen, setIsOpen] = useState(false)

  // Close sidebar when window is resized to desktop size
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsOpen(false)
      }
    }

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  // Listen for custom events
  useEffect(() => {
    const handleToggleSidebar = () => {
      setIsOpen((prev) => !prev)
    }

    const handleOpenSidebar = () => {
      setIsOpen(true)
    }

    const handleCloseSidebar = () => {
      setIsOpen(false)
    }

    document.addEventListener("toggle-sidebar", handleToggleSidebar)
    document.addEventListener("open-sidebar", handleOpenSidebar)
    document.addEventListener("close-sidebar", handleCloseSidebar)

    return () => {
      document.removeEventListener("toggle-sidebar", handleToggleSidebar)
      document.removeEventListener("open-sidebar", handleOpenSidebar)
      document.removeEventListener("close-sidebar", handleCloseSidebar)
    }
  }, [])

  // Prevent body scroll when sidebar is open on mobile
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [isOpen])

  const toggleSidebar = () => {
    setIsOpen(!isOpen)
  }

  return {
    isOpen,
    setIsOpen,
    toggleSidebar,
  }
}
