'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import * as Y from 'yjs'
import { useSocket } from './socketContext'
import { documentsApi } from './api'
import { WebsocketProvider } from 'y-websocket'

interface Document {
  id: string
  title: string
  content: any
  lastModified: Date
  createdBy: string
}

interface DocumentsContextType {
  documents: Document[]
  activeDocument: Document | null
  activeYDoc: Y.Doc | null
  provider: any | null
  openDocument: (docId: string) => void
  createDocument: () => string
  updateDocumentTitle: (docId: string, title: string) => void
  saveDocument: () => void
  loading: boolean
  error: string | null
}

const DocumentsContext = createContext<DocumentsContextType>({
  documents: [],
  activeDocument: null,
  activeYDoc: null,
  provider: null,
  openDocument: () => { },
  createDocument: () => '',
  updateDocumentTitle: () => { },
  saveDocument: () => { },
  loading: false,
  error: null
})

export const useDocuments = () => useContext(DocumentsContext)

export const DocumentsProvider = ({ children }: { children: React.ReactNode }) => {
  const [documents, setDocuments] = useState<Document[]>([])
  const [activeDocument, setActiveDocument] = useState<Document | null>(null)
  const [activeYDoc, setActiveYDoc] = useState<Y.Doc | null>(null)
  const [provider, setProvider] = useState<any | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const socketContext = useSocket()

  useEffect(() => {
    const fetchDocuments = async () => {
      setLoading(true)
      try {
        const response = await documentsApi.getAllDocuments()
        setDocuments(response)

        if (response.length > 0 && !activeDocument) {
          setActiveDocument(response[0])
        }
      } catch (err) {
        setError('Failed to load documents')

        setDocuments([
          {
            id: 'doc1',
            title: 'Product Specifications',
            content: {},
            lastModified: new Date(),
            createdBy: 'user1'
          },
          {
            id: 'doc2',
            title: 'Meeting Notes',
            content: {},
            lastModified: new Date(),
            createdBy: 'user1'
          }
        ])
      } finally {
        setLoading(false)
      }
    }

    fetchDocuments()
  }, [])

  const createDocument = useCallback((): string => {
    try {
      setLoading(true)

      // Generate a temporary ID (will be replaced by server's ID)
      const tempId = `doc-${Date.now()}`

      const newDoc: Document = {
        id: tempId,
        title: 'Untitled Document',
        content: {},
        lastModified: new Date(),
        createdBy: 'currentUser', // In a real app, use the actual user ID
      }

      setDocuments(prevDocs => [...prevDocs, newDoc])

      documentsApi.createDocument({ title: 'Untitled Document' })
        .then(response => {
          setDocuments(prevDocs =>
            prevDocs.map(doc =>
              doc.id === tempId ? { ...doc, id: response.id } : doc
            )
          )

          if (activeDocument?.id === tempId) {
            setActiveDocument(prev => prev ? { ...prev, id: response.id } : null)
          }

          return response.id
        })
        .catch(err => {
        })
        .finally(() => {
          setLoading(false)
        })

      return tempId
    } catch (error) {
      setLoading(false)
      return 'doc1'
    }
  }, [activeDocument])

  const openDocument = useCallback((docId: string) => {
    setLoading(true)
    setError(null)

    try {
      const doc = documents.find(d => d.id === docId)

      if (!doc) {
        throw new Error(`Document not found: ${docId}`)
      }

      const yDoc = new Y.Doc()

      const wsProvider = {
        connect: () => {
          const ws = new WebSocket(`ws://localhost:3003?documentId=${docId}&userId=currentUser`)

          ws.onopen = () => {
          }

          ws.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data)
            } catch (err) {
            }
          }

          ws.onclose = () => {
          }

          ws.onerror = (error) => {
            setError('Connection error')
          }

          return ws
        },
        disconnect: () => {
        }
      }

      setActiveDocument(doc)
      setActiveYDoc(yDoc)
      setProvider(wsProvider)
      setLoading(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error opening document')
      setLoading(false)

      if (err instanceof Error && err.message.includes('not found')) {
        documentsApi.getDocument(docId)
          .then(response => {
            setDocuments(prevDocs => [...prevDocs, response])
            openDocument(docId)
          })
          .catch(fetchErr => {
          })
      }
    }
  }, [documents])

  const updateDocumentTitle = useCallback((docId: string, title: string) => {
    setDocuments(prevDocs =>
      prevDocs.map(doc =>
        doc.id === docId
          ? { ...doc, title, lastModified: new Date() }
          : doc
      )
    )

    if (activeDocument?.id === docId) {
      setActiveDocument(prev => prev ? { ...prev, title, lastModified: new Date() } : null)
    }

    documentsApi.updateDocument(docId, { title })
      .catch(err => {
      })
  }, [activeDocument])

  const saveDocument = useCallback(() => {
    if (!activeDocument || !activeYDoc) {
      return
    }

    setLoading(true)

    try {
      const content = activeYDoc.toJSON()

      documentsApi.updateDocument(activeDocument.id, { content })
        .then(response => {
          const updatedDoc = { ...activeDocument, lastModified: new Date() }

          setDocuments(prevDocs =>
            prevDocs.map(doc =>
              doc.id === activeDocument.id ? updatedDoc : doc
            )
          )

          setActiveDocument(updatedDoc)
        })
        .catch(err => {
          setError('Failed to save document')
        })
        .finally(() => {
          setLoading(false)
        })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error saving document')
      setLoading(false)
    }
  }, [activeDocument, activeYDoc])

  useEffect(() => {
    return () => {
      if (provider) {
        provider.disconnect()
      }
      if (activeYDoc) {
        activeYDoc.destroy()
      }
    }
  }, [provider, activeYDoc])

  return (
    <DocumentsContext.Provider
      value={{
        documents,
        activeDocument,
        activeYDoc,
        provider,
        openDocument,
        createDocument,
        updateDocumentTitle,
        saveDocument,
        loading,
        error
      }}
    >
      {children}
    </DocumentsContext.Provider>
  )
}