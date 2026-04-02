"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { TeamagerLogo } from "@/components/teamager-logo"
import { ChevronDown, ChevronRight, FileText, Folder, Menu, Plus, Search, X } from "lucide-react"

interface MobileNavProps {
  activeDocument: string
  setActiveDocument: (doc: string) => void
}

export function MobileNav({ activeDocument, setActiveDocument }: MobileNavProps) {
  const [isOpen, setIsOpen] = useState(false)

  // Close the mobile nav when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (isOpen && !target.closest(".mobile-nav") && !target.closest(".mobile-nav-toggle")) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isOpen])

  // Prevent body scroll when nav is open
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

  return (
    <>
      <Button variant="ghost" size="icon" className="md:hidden mobile-nav-toggle" onClick={() => setIsOpen(true)}>
        <Menu className="h-5 w-5" />
        <span className="sr-only">Open menu</span>
      </Button>

      {isOpen && <div className="mobile-nav-overlay" onClick={() => setIsOpen(false)} />}

      <div className={`mobile-nav ${isOpen ? "open" : "closed"}`}>
        <div className="flex h-14 items-center justify-between border-b px-4">
          <div className="flex items-center gap-2 font-bold">
            <TeamagerLogo className="h-5 w-5" />
            {/* Teamager */}
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="overflow-auto h-[calc(100vh-3.5rem)] py-2">
          <div className="px-3 py-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input type="search" placeholder="Search documents" className="w-full pl-8 text-sm" />
            </div>
          </div>

          <div className="mt-2">
            <div className="px-3 py-1.5 flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase">Workspace</span>
              <Button variant="ghost" size="icon" className="h-5 w-5">
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            <div className="mt-1">
              <Button variant="ghost" className="w-full justify-start px-3 py-1.5 h-8 text-sm font-medium">
                <FileText className="h-4 w-4 mr-2" />
                Getting Started
              </Button>
              <div>
                <Button variant="ghost" className="w-full justify-start px-3 py-1.5 h-8 text-sm font-medium">
                  <ChevronDown className="h-4 w-4 mr-2" />
                  <Folder className="h-4 w-4 mr-2" />
                  Product
                </Button>
                <div className="pl-8">
                  <Button variant="ghost" className="w-full justify-start px-3 py-1.5 h-8 text-sm font-medium">
                    <FileText className="h-4 w-4 mr-2" />
                    Roadmap
                  </Button>
                  <Button
                    variant="ghost"
                    className={`w-full justify-start px-3 py-1.5 h-8 text-sm font-medium ${activeDocument === "Product Specs" ? "bg-secondary" : ""
                      }`}
                    onClick={() => {
                      setActiveDocument("Product Specs")
                      setIsOpen(false)
                    }}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Product Specs
                  </Button>
                </div>
              </div>
              <div>
                <Button variant="ghost" className="w-full justify-start px-3 py-1.5 h-8 text-sm font-medium">
                  <ChevronRight className="h-4 w-4 mr-2" />
                  <Folder className="h-4 w-4 mr-2" />
                  Engineering
                </Button>
              </div>
              <div>
                <Button variant="ghost" className="w-full justify-start px-3 py-1.5 h-8 text-sm font-medium">
                  <ChevronRight className="h-4 w-4 mr-2" />
                  <Folder className="h-4 w-4 mr-2" />
                  Marketing
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <div className="px-3 py-1.5 flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase">Recent</span>
            </div>
            <div className="mt-1">
              <Button
                variant="ghost"
                className="w-full justify-start px-3 py-1.5 h-8 text-sm font-medium"
                onClick={() => {
                  setActiveDocument("Product Specs")
                  setIsOpen(false)
                }}
              >
                <FileText className="h-4 w-4 mr-2" />
                Product Specs
              </Button>
              <Button variant="ghost" className="w-full justify-start px-3 py-1.5 h-8 text-sm font-medium">
                <FileText className="h-4 w-4 mr-2" />
                Weekly Update
              </Button>
              <Button variant="ghost" className="w-full justify-start px-3 py-1.5 h-8 text-sm font-medium">
                <FileText className="h-4 w-4 mr-2" />
                API Documentation
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
