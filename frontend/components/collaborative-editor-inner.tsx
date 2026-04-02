'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
import Heading from '@tiptap/extension-heading'
import BulletList from '@tiptap/extension-bullet-list'
import OrderedList from '@tiptap/extension-ordered-list'
import ListItem from '@tiptap/extension-list-item'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Blockquote from '@tiptap/extension-blockquote'
import CodeBlock from '@tiptap/extension-code-block'
import HorizontalRule from '@tiptap/extension-horizontal-rule'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import TextStyle from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  Users, Wifi, WifiOff, Save, RefreshCw,
  Code, Quote, Minus, Table as TableIcon,
  CheckSquare, Type
} from 'lucide-react'

interface CollaborativeEditorProps {
  documentId: string
  initialContent: string
  user: any
  canEdit: boolean
  onSave: (content: string) => Promise<void>
}

const COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FECA57', '#FF9FF3', '#54A0FF', '#5F27CD',
  '#48CAE4', '#F72585', '#4CC9F0', '#7209B7',
]

function getUserColor(userId: string): string {
  const hash = userId.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0)
    return a & a
  }, 0)
  return COLORS[Math.abs(hash) % COLORS.length]
}

export default function CollaborativeEditorInner({
  documentId,
  initialContent,
  user,
  canEdit,
  onSave,
}: CollaborativeEditorProps) {
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [collaborators, setCollaborators] = useState<any[]>([])
  const saveTimeoutRef = useRef<NodeJS.Timeout>()
  const editorRef = useRef<HTMLDivElement>(null)

  // Slash menu state
  const [showSlashMenu, setShowSlashMenu] = useState(false)
  const [slashMenuPosition, setSlashMenuPosition] = useState({ x: 0, y: 0 })
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [slashQuery, setSlashQuery] = useState('')

  // Create Y.js doc and provider once per documentId
  const { ydoc, provider } = useMemo(() => {
    const doc = new Y.Doc()
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
    const wsUrl = apiUrl.replace(/^http/, 'ws') + '/yjs'

    const prov = new WebsocketProvider(wsUrl, documentId, doc, {
      connect: true,
      disableBc: true,
    })

    return { ydoc: doc, provider: prov }
  }, [documentId])

  // Connection status & awareness
  useEffect(() => {
    const handleStatus = (event: { status: string }) => {
      setIsConnected(event.status === 'connected')
    }
    provider.on('status', handleStatus)

    // Set local user info for cursor display
    provider.awareness.setLocalStateField('user', {
      name: user.name || user.email || 'Anonymous',
      color: getUserColor(user.id),
      id: user.id,
    })

    // Track other collaborators via awareness
    const handleAwarenessChange = () => {
      const states = Array.from(provider.awareness.getStates().entries())
      const users = states
        .filter(([clientId]) => clientId !== provider.awareness.clientID)
        .map(([, state]) => (state as any).user)
        .filter(Boolean)
      setCollaborators(users)
    }
    provider.awareness.on('change', handleAwarenessChange)

    return () => {
      provider.off('status', handleStatus)
      provider.awareness.off('change', handleAwarenessChange)
      provider.destroy()
      ydoc.destroy()
    }
  }, [provider, ydoc, user])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
        history: false, // Y.js handles undo/redo
      }),
      Collaboration.configure({
        document: ydoc,
      }),
      CollaborationCursor.configure({
        provider,
        user: {
          name: user.name || user.email || 'Anonymous',
          color: getUserColor(user.id),
        },
      }),
      Heading.configure({
        levels: [1, 2, 3, 4, 5, 6],
        HTMLAttributes: { class: 'font-bold leading-tight' },
      }),
      BulletList.configure({
        HTMLAttributes: { class: 'list-disc list-inside my-4 ml-6 space-y-1' },
      }),
      OrderedList.configure({
        HTMLAttributes: { class: 'list-decimal list-inside my-4 ml-6 space-y-1' },
      }),
      ListItem.configure({
        HTMLAttributes: { class: 'leading-relaxed' },
      }),
      TaskList.configure({
        HTMLAttributes: { class: 'my-4 space-y-2' },
      }),
      TaskItem.configure({
        HTMLAttributes: { class: 'flex items-start space-x-2' },
        nested: true,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-300 cursor-pointer',
        },
      }),
      Image.configure({
        HTMLAttributes: { class: 'max-w-full h-auto rounded-lg my-4 shadow-md' },
      }),
      Blockquote.configure({
        HTMLAttributes: {
          class: 'border-l-4 border-gray-300 dark:border-gray-600 pl-4 my-4 italic text-gray-700 dark:text-gray-300',
        },
      }),
      CodeBlock.configure({
        HTMLAttributes: {
          class: 'bg-gray-100 dark:bg-gray-800 rounded-lg p-4 my-4 font-mono text-sm overflow-x-auto',
        },
      }),
      HorizontalRule.configure({
        HTMLAttributes: { class: 'my-8 border-t-2 border-gray-200 dark:border-gray-700' },
      }),
      Table.configure({
        HTMLAttributes: { class: 'border-collapse table-auto w-full my-4' },
        resizable: true,
      }),
      TableRow.configure({
        HTMLAttributes: { class: 'border-b border-gray-200 dark:border-gray-700' },
      }),
      TableHeader.configure({
        HTMLAttributes: {
          class: 'border border-gray-300 dark:border-gray-600 px-4 py-2 text-left font-semibold bg-gray-50 dark:bg-gray-800',
        },
      }),
      TableCell.configure({
        HTMLAttributes: { class: 'border border-gray-300 dark:border-gray-600 px-4 py-2' },
      }),
      TextStyle,
      Color.configure({ types: [TextStyle.name, ListItem.name] }),
      Highlight.configure({
        multicolor: true,
        HTMLAttributes: { class: 'rounded px-1' },
      }),
    ],
    immediatelyRender: false,
    editable: canEdit,
    editorProps: {
      attributes: {
        class: 'focus:outline-none min-h-[400px] p-4',
        style: 'font-size: inherit;',
      },
    },
    onUpdate: ({ editor }) => {
      if (!canEdit) return

      // Auto-save with debounce
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = setTimeout(async () => {
        try {
          setIsSaving(true)
          await onSave(editor.getHTML())
          setLastSaved(new Date())
        } catch (error) {
          console.error('Auto-save failed:', error)
        } finally {
          setIsSaving(false)
        }
      }, 3000)
    },
  })

  // Load initial content into Y.js doc when it's empty after sync
  useEffect(() => {
    if (!editor || !initialContent) return

    const handleSync = (isSynced: boolean) => {
      if (isSynced) {
        const fragment = ydoc.getXmlFragment('default')
        if (fragment.length === 0) {
          editor.commands.setContent(initialContent)
        }
      }
    }

    provider.on('sync', handleSync)
    if (provider.synced) handleSync(true)

    // Fallback: if server is unreachable, load content after timeout
    const timeout = setTimeout(() => {
      if (!provider.synced) {
        const fragment = ydoc.getXmlFragment('default')
        if (fragment.length === 0 && editor) {
          editor.commands.setContent(initialContent)
        }
      }
    }, 2000)

    return () => {
      provider.off('sync', handleSync)
      clearTimeout(timeout)
    }
  }, [editor, provider, ydoc, initialContent])

  // Update editable when canEdit changes
  useEffect(() => {
    if (editor) editor.setEditable(canEdit)
  }, [editor, canEdit])

  // Handle mobile formatting events
  useEffect(() => {
    const handleMobileFormat = (event: CustomEvent) => {
      if (!editor || !canEdit) return
      const command = event.detail
      switch (command) {
        case 'bold': editor.chain().focus().toggleBold().run(); break
        case 'italic': editor.chain().focus().toggleItalic().run(); break
        case 'heading1': editor.chain().focus().toggleHeading({ level: 1 }).run(); break
        case 'bulletList': editor.chain().focus().toggleBulletList().run(); break
        case 'quote': editor.chain().focus().toggleBlockquote().run(); break
        case 'redText': editor.chain().focus().setColor('#ef4444').run(); break
        case 'blueText': editor.chain().focus().setColor('#3b82f6').run(); break
        case 'yellowHighlight': editor.chain().focus().setHighlight({ color: '#fbbf24' }).run(); break
        case 'clearFormat': editor.chain().focus().unsetAllMarks().run(); break
      }
    }
    window.addEventListener('editor-format', handleMobileFormat as EventListener)
    return () => window.removeEventListener('editor-format', handleMobileFormat as EventListener)
  }, [editor, canEdit])

  // Slash commands
  const getSlashCommands = useCallback(() => {
    const allCommands = [
      { title: 'Heading 1', description: 'Large heading', icon: 'H1', keywords: ['heading', 'h1', 'title'], command: () => editor?.chain().focus().toggleHeading({ level: 1 }).run() },
      { title: 'Heading 2', description: 'Medium heading', icon: 'H2', keywords: ['heading', 'h2', 'subtitle'], command: () => editor?.chain().focus().toggleHeading({ level: 2 }).run() },
      { title: 'Heading 3', description: 'Small heading', icon: 'H3', keywords: ['heading', 'h3'], command: () => editor?.chain().focus().toggleHeading({ level: 3 }).run() },
      { title: 'Bullet List', description: 'Unordered list', icon: '\u2022', keywords: ['list', 'bullet', 'ul'], command: () => editor?.chain().focus().toggleBulletList().run() },
      { title: 'Numbered List', description: 'Ordered list', icon: '1.', keywords: ['list', 'numbered', 'ol', 'order'], command: () => editor?.chain().focus().toggleOrderedList().run() },
      { title: 'Task List', description: 'Checklist', icon: '\u2611', keywords: ['task', 'todo', 'checklist', 'checkbox'], command: () => editor?.chain().focus().toggleTaskList().run() },
      { title: 'Quote', description: 'Blockquote', icon: '\u201C', keywords: ['quote', 'blockquote', 'citation'], command: () => editor?.chain().focus().toggleBlockquote().run() },
      { title: 'Code Block', description: 'Code snippet', icon: '{}', keywords: ['code', 'block', 'snippet', 'programming'], command: () => editor?.chain().focus().toggleCodeBlock().run() },
      { title: 'Divider', description: 'Horizontal rule', icon: '\u2014', keywords: ['divider', 'separator', 'line', 'hr'], command: () => editor?.chain().focus().setHorizontalRule().run() },
      { title: 'Table', description: '3x3 table', icon: '\u229E', keywords: ['table', 'grid', 'data'], command: () => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
      { title: 'Image', description: 'Upload or embed', icon: '\uD83D\uDDBC', keywords: ['image', 'picture', 'photo'], command: () => { const url = window.prompt('Enter image URL:'); if (url) editor?.chain().focus().setImage({ src: url }).run() } },
      { title: 'Red Text', description: 'Color text red', icon: '\uD83D\uDD34', keywords: ['red', 'color', 'text'], command: () => editor?.chain().focus().setColor('#ef4444').run() },
      { title: 'Blue Text', description: 'Color text blue', icon: '\uD83D\uDD35', keywords: ['blue', 'color', 'text'], command: () => editor?.chain().focus().setColor('#3b82f6').run() },
      { title: 'Green Text', description: 'Color text green', icon: '\uD83D\uDFE2', keywords: ['green', 'color', 'text'], command: () => editor?.chain().focus().setColor('#22c55e').run() },
      { title: 'Yellow Highlight', description: 'Highlight with yellow', icon: '\uD83D\uDFE1', keywords: ['yellow', 'highlight', 'background'], command: () => editor?.chain().focus().setHighlight({ color: '#fbbf24' }).run() },
      { title: 'Clear Format', description: 'Remove formatting', icon: '\uD83E\uDDF9', keywords: ['clear', 'remove', 'format', 'clean'], command: () => editor?.chain().focus().unsetAllMarks().run() },
    ]
    if (!slashQuery.trim()) return allCommands
    const q = slashQuery.toLowerCase()
    return allCommands.filter(cmd =>
      cmd.title.toLowerCase().includes(q) ||
      cmd.description.toLowerCase().includes(q) ||
      cmd.keywords.some(k => k.includes(q))
    )
  }, [editor, slashQuery])

  const slashMenuItems = useMemo(() => getSlashCommands(), [getSlashCommands])

  // Slash menu keyboard handler
  useEffect(() => {
    if (!editor || !editorRef.current) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === '/' && canEdit && !showSlashMenu) {
        const { state } = editor
        const { $head } = state.selection
        const beforeCursor = $head.parent.textBetween(Math.max(0, $head.parentOffset - 1), $head.parentOffset)
        const isValidPosition = $head.parentOffset === 0 || /\s/.test(beforeCursor)
        if (isValidPosition) {
          setTimeout(() => {
            const coords = editor.view.coordsAtPos($head.pos + 1)
            const editorRect = editorRef.current?.getBoundingClientRect()
            if (editorRect) {
              setSlashMenuPosition({ x: coords.left - editorRect.left, y: coords.bottom - editorRect.top + 5 })
              setSlashQuery('')
              setSelectedIndex(0)
              setShowSlashMenu(true)
            }
          }, 50)
        }
      }

      if (showSlashMenu) {
        if (event.key === 'ArrowDown') { event.preventDefault(); setSelectedIndex(prev => (prev + 1) % slashMenuItems.length); return }
        if (event.key === 'ArrowUp') { event.preventDefault(); setSelectedIndex(prev => (prev - 1 + slashMenuItems.length) % slashMenuItems.length); return }
        if (event.key === 'Enter') {
          event.preventDefault()
          const selectedItem = slashMenuItems[selectedIndex]
          if (selectedItem) {
            const { state } = editor
            const { from } = state.selection
            const beforeCursor = state.doc.textBetween(Math.max(0, from - 20), from)
            const slashIndex = beforeCursor.lastIndexOf('/')
            if (slashIndex !== -1) {
              const deleteFrom = from - (beforeCursor.length - slashIndex)
              editor.chain().deleteRange({ from: deleteFrom, to: from }).run()
            }
            selectedItem.command()
            setShowSlashMenu(false)
            setSlashQuery('')
          }
          return
        }
        if (event.key === 'Escape') { event.preventDefault(); setShowSlashMenu(false); setSlashQuery(''); return }
        if (event.key === 'Backspace') {
          const { state } = editor
          const { from } = state.selection
          const beforeCursor = state.doc.textBetween(Math.max(0, from - 20), from)
          const slashIndex = beforeCursor.lastIndexOf('/')
          if (slashIndex !== -1 && beforeCursor.slice(slashIndex + 1).length === 0) {
            setShowSlashMenu(false)
            setSlashQuery('')
            return
          }
        }
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
          setTimeout(() => {
            const { state } = editor
            const { from } = state.selection
            const beforeCursor = state.doc.textBetween(Math.max(0, from - 20), from)
            const slashIndex = beforeCursor.lastIndexOf('/')
            if (slashIndex !== -1) {
              setSlashQuery(beforeCursor.slice(slashIndex + 1))
              setSelectedIndex(0)
            }
          }, 10)
        }
      }
    }

    const editorElement = editorRef.current.querySelector('.ProseMirror')
    if (editorElement) {
      editorElement.addEventListener('keydown', handleKeyDown)
      return () => editorElement.removeEventListener('keydown', handleKeyDown)
    }
  }, [editor, canEdit, showSlashMenu, slashMenuItems, selectedIndex])

  // Cleanup
  useEffect(() => {
    return () => { if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current) }
  }, [])

  const handleManualSave = async () => {
    if (!editor || !canEdit) return
    try {
      setIsSaving(true)
      await onSave(editor.getHTML())
      setLastSaved(new Date())
    } catch (error) {
      console.error('Manual save failed:', error)
    } finally {
      setIsSaving(false)
    }
  }

  if (!editor) {
    return (
      <div className="animate-pulse">
        <div className="h-96 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
        <div className="mt-2 text-center text-sm text-gray-500">Initializing editor...</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Status Bar */}
      <Card>
        <CardHeader className="pb-3">
          {/* Mobile Layout */}
          <div className="flex flex-col space-y-3 md:hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {isConnected ? <Wifi className="h-4 w-4 text-green-500" /> : <WifiOff className="h-4 w-4 text-red-500" />}
                <span className="text-sm font-medium">
                  {isConnected ? 'Connected' : 'Disconnected'} {!canEdit && '(Read-only)'}
                </span>
              </div>
              <Button variant="outline" size="sm" onClick={handleManualSave} disabled={isSaving || !canEdit}>
                {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                <span className="ml-1">{isSaving ? 'Saving...' : 'Save'}</span>
              </Button>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2">
                  <Users className="h-4 w-4 text-blue-500" />
                  <span className="text-sm">{collaborators.length + 1} online</span>
                </div>
                {collaborators.length > 0 && (
                  <div className="flex items-center space-x-1">
                    {collaborators.slice(0, 3).map((c, i) => (
                      <div key={i} className="w-6 h-6 rounded-full flex items-center justify-center text-xs text-white font-medium" style={{ backgroundColor: c.color }} title={c.name}>
                        {c.name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                    ))}
                    {collaborators.length > 3 && (
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs bg-gray-500 text-white font-medium">+{collaborators.length - 3}</div>
                    )}
                  </div>
                )}
              </div>
              {lastSaved && <span className="text-xs text-gray-500">Saved {lastSaved.toLocaleTimeString()}</span>}
            </div>
          </div>

          {/* Desktop Layout */}
          <div className="hidden md:flex items-center justify-between">
            <div className="flex items-center space-x-4 lg:space-x-6">
              <div className="flex items-center space-x-2">
                {isConnected ? <Wifi className="h-4 w-4 text-green-500" /> : <WifiOff className="h-4 w-4 text-red-500" />}
                <span className="text-sm font-medium">
                  {isConnected ? 'Connected' : 'Disconnected'} {!canEdit && '(Read-only)'}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <Users className="h-4 w-4 text-blue-500" />
                <span className="text-sm">{collaborators.length + 1} online</span>
              </div>
              {collaborators.length > 0 && (
                <div className="flex items-center space-x-1">
                  {collaborators.map((c, i) => (
                    <div key={i} className="w-6 h-6 rounded-full flex items-center justify-center text-xs text-white font-medium" style={{ backgroundColor: c.color }} title={c.name}>
                      {c.name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center space-x-3">
              {lastSaved && <span className="text-xs text-gray-500 hidden lg:inline">Saved {lastSaved.toLocaleTimeString()}</span>}
              <Button variant="outline" size="sm" onClick={handleManualSave} disabled={isSaving || !canEdit}>
                {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                <span className="ml-1 hidden sm:inline">{isSaving ? 'Saving...' : 'Save'}</span>
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Editor */}
      <Card>
        <CardContent className="p-0">
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            {/* Toolbar Row 1 - Text Formatting */}
            <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center space-x-1 flex-wrap gap-y-1">
                  <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleBold().run()} disabled={!canEdit} className={editor.isActive('bold') ? 'bg-gray-200 dark:bg-gray-600' : ''} title="Bold"><strong>B</strong></Button>
                  <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleItalic().run()} disabled={!canEdit} className={editor.isActive('italic') ? 'bg-gray-200 dark:bg-gray-600' : ''} title="Italic"><em>I</em></Button>
                  <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleStrike().run()} disabled={!canEdit} className={editor.isActive('strike') ? 'bg-gray-200 dark:bg-gray-600' : ''} title="Strikethrough"><s>S</s></Button>
                  <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleCode().run()} disabled={!canEdit} className={editor.isActive('code') ? 'bg-gray-200 dark:bg-gray-600' : ''} title="Inline code"><Code className="h-4 w-4" /></Button>
                  <div className="w-px h-6 bg-gray-300 dark:bg-gray-600" />
                  <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().setParagraph().run()} disabled={!canEdit} className={editor.isActive('paragraph') ? 'bg-gray-200 dark:bg-gray-600' : ''} title="Paragraph"><Type className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} disabled={!canEdit} className={editor.isActive('heading', { level: 1 }) ? 'bg-gray-200 dark:bg-gray-600' : ''} title="Heading 1">H1</Button>
                  <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} disabled={!canEdit} className={editor.isActive('heading', { level: 2 }) ? 'bg-gray-200 dark:bg-gray-600' : ''} title="Heading 2">H2</Button>
                  <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} disabled={!canEdit} className={editor.isActive('heading', { level: 3 }) ? 'bg-gray-200 dark:bg-gray-600' : ''} title="Heading 3">H3</Button>
                </div>
              </div>

              {/* Toolbar Row 2 - Blocks and Lists */}
              <div className="p-2">
                <div className="flex items-center space-x-1 flex-wrap gap-y-1">
                  <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleBulletList().run()} disabled={!canEdit} className={editor.isActive('bulletList') ? 'bg-gray-200 dark:bg-gray-600' : ''} title="Bullet list">{'\u2022'} List</Button>
                  <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleOrderedList().run()} disabled={!canEdit} className={editor.isActive('orderedList') ? 'bg-gray-200 dark:bg-gray-600' : ''} title="Numbered list">1. List</Button>
                  <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleTaskList().run()} disabled={!canEdit} className={editor.isActive('taskList') ? 'bg-gray-200 dark:bg-gray-600' : ''} title="Task list"><CheckSquare className="h-4 w-4" /></Button>
                  <div className="w-px h-6 bg-gray-300 dark:bg-gray-600" />
                  <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleBlockquote().run()} disabled={!canEdit} className={editor.isActive('blockquote') ? 'bg-gray-200 dark:bg-gray-600' : ''} title="Quote"><Quote className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleCodeBlock().run()} disabled={!canEdit} className={editor.isActive('codeBlock') ? 'bg-gray-200 dark:bg-gray-600' : ''} title="Code block">{'{}'}</Button>
                  <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().setHorizontalRule().run()} disabled={!canEdit} title="Horizontal rule"><Minus className="h-4 w-4" /></Button>
                  <div className="w-px h-6 bg-gray-300 dark:bg-gray-600" />
                  <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} disabled={!canEdit} title="Insert table"><TableIcon className="h-4 w-4" /></Button>
                  <div className="w-px h-6 bg-gray-300 dark:bg-gray-600" />
                  <Button variant="ghost" size="sm" onClick={() => { const url = window.prompt('Enter link URL:'); if (url) editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run() }} disabled={!canEdit} className={editor.isActive('link') ? 'bg-gray-200 dark:bg-gray-600' : ''} title="Add link">{'\uD83D\uDD17'}</Button>
                  <Button variant="ghost" size="sm" onClick={() => { const url = window.prompt('Enter image URL:'); if (url) editor.chain().focus().setImage({ src: url }).run() }} disabled={!canEdit} title="Add image">{'\uD83D\uDDBC\uFE0F'}</Button>
                  <div className="w-px h-6 bg-gray-300 dark:bg-gray-600" />
                  <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().setColor('#ef4444').run()} disabled={!canEdit} title="Red text">{'\uD83D\uDD34'}</Button>
                  <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().setColor('#3b82f6').run()} disabled={!canEdit} title="Blue text">{'\uD83D\uDD35'}</Button>
                  <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().setColor('#22c55e').run()} disabled={!canEdit} title="Green text">{'\uD83D\uDFE2'}</Button>
                  <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().setHighlight({ color: '#fbbf24' }).run()} disabled={!canEdit} title="Yellow highlight">{'\uD83D\uDFE1'}</Button>
                  <Button variant="ghost" size="sm" onClick={() => editor.chain().focus().unsetAllMarks().run()} disabled={!canEdit} title="Clear formatting">{'\uD83E\uDDF9'}</Button>
                </div>
              </div>
            </div>

            {/* Editor Content */}
            <div ref={editorRef} className="bg-white dark:bg-gray-900 relative">
              <EditorContent editor={editor} />

              {/* Slash Commands Menu */}
              {showSlashMenu && (
                <div
                  className="absolute z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 min-w-[200px] max-h-[300px] overflow-y-auto"
                  style={{ left: slashMenuPosition.x, top: slashMenuPosition.y }}
                >
                  {slashQuery && (
                    <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-t-lg">
                      Searching for: &quot;<span className="font-mono">{slashQuery}</span>&quot;
                    </div>
                  )}
                  {slashMenuItems.length === 0 ? (
                    <div className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                      No commands found for &quot;{slashQuery}&quot;
                    </div>
                  ) : (
                    slashMenuItems.map((item, index) => (
                      <button
                        key={index}
                        className={`w-full text-left px-3 py-2 flex items-center space-x-3 first:rounded-t-lg last:rounded-b-lg transition-colors ${
                          index === selectedIndex
                            ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-900 dark:text-blue-100'
                            : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                        onClick={() => {
                          const { state } = editor
                          const { from } = state.selection
                          const beforeCursor = state.doc.textBetween(Math.max(0, from - 10), from)
                          const slashIndex = beforeCursor.lastIndexOf('/')
                          if (slashIndex !== -1) {
                            const deleteFrom = from - (beforeCursor.length - slashIndex)
                            editor.chain().deleteRange({ from: deleteFrom, to: from }).run()
                          }
                          item.command()
                          setShowSlashMenu(false)
                        }}
                      >
                        <span className="text-lg font-mono w-6 text-center">{item.icon}</span>
                        <div>
                          <div className="font-medium text-sm">{item.title}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{item.description}</div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mobile Tip */}
      <div className="md:hidden mt-2">
        <div className="text-center text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg p-2">
          Tip: Type &quot;/&quot; + text to filter commands (e.g., &quot;/red&quot; for colors)
        </div>
      </div>
    </div>
  )
}
