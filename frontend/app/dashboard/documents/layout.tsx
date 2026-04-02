"use client"

import { DocumentsProvider } from "@/lib/documentsContext"

export default function DocumentsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <DocumentsProvider>
      {children}
    </DocumentsProvider>
  )
}