'use client'

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'

interface CollaborativeEditorProps {
  documentId: string
  initialContent: string
  user: any
  canEdit: boolean
  onSave: (content: string) => Promise<void>
}

// Dynamically import the editor to avoid SSR issues with Y.js
const EditorInner = dynamic(() => import('./collaborative-editor-inner'), {
  ssr: false,
  loading: () => (
    <div className="animate-pulse">
      <div className="h-96 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
      <div className="mt-2 text-center text-sm text-gray-500">
        Loading collaborative editor...
      </div>
    </div>
  ),
})

export function CollaborativeEditor(props: CollaborativeEditorProps) {
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  if (!isClient || !props.user) {
    return (
      <div className="animate-pulse">
        <div className="h-96 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
      </div>
    )
  }

  return <EditorInner {...props} />
}
