'use client'

import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/authContext'
import api, { documentsApi } from '@/lib/api'
import { CollaborativeEditor } from '@/components/collaborative-editor'
import DocumentPermissionsDialog from '@/components/document-permissions-dialog'
import { Button } from '@/components/ui/button'
import { Users, ArrowLeft, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function DocumentPage() {
  const params = useParams()
  const documentId = params.id as string
  const { user } = useAuth()
  const router = useRouter()
  
  const [document, setDocument] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDocument = async () => {
    try {
      setLoading(true)
      const document = await documentsApi.getDocument(documentId)
      setDocument(document)
    } catch (err: any) {
      console.error('Failed to fetch document:', err)
      setError(err.response?.data?.message || 'Failed to load document')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (documentId && user) {
      fetchDocument()
    }
  }, [documentId, user])

  const handleDeleteDocument = async () => {
    if (!confirm(`Are you sure you want to delete "${document?.title}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await documentsApi.deleteDocument(documentId);
      router.push('/dashboard/documents');
    } catch (err: any) {
      alert(`Failed to delete document: ${err.response?.data?.message || err.message}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-4"></div>
            <div className="h-96 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-lg p-4">
            <h2 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-2">
              Error Loading Document
            </h2>
            <p className="text-red-600 dark:text-red-300">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
        <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => router.push('/dashboard/documents')}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Documents
            </Button>
            
            <div className="flex items-center gap-2">
              {(document?.permissions?.canShare || document?.permissions?.effectiveRole === 'owner' || document?.permissions?.canAdmin) && (
                <DocumentPermissionsDialog
                  documentId={documentId}
                  canManagePermissions={document?.permissions?.canShare || document?.permissions?.effectiveRole === 'owner' || document?.permissions?.canAdmin}
                  onPermissionsUpdated={fetchDocument}
                  trigger={
                    <Button variant="outline" size="sm" className="gap-1">
                      <Users className="w-4 h-4" />
                      Permissions
                    </Button>
                  }
                />
              )}
              
              {document?.permissions?.canDelete && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleDeleteDocument}
                  className="gap-1 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </Button>
              )}
            </div>
          </div>
          
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            {document?.title || 'Untitled Document'}
          </h1>
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Created by {document?.authorName} • Last updated {new Date(document?.updatedAt).toLocaleDateString()}
            </div>
            {document?.permissions?.effectiveRole && (
              <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
                {document.permissions.effectiveRole === 'owner' ? 'Owner' : document.permissions.effectiveRole}
              </span>
            )}
          </div>
        </div>

        <CollaborativeEditor 
          documentId={documentId}
          canEdit={document?.permissions?.canEdit || false}
          initialContent={document?.content || ''}
          user={user}
          onSave={async (content: string) => {
            try {
              await documentsApi.updateDocument(documentId, { content })
            } catch (error) {
              console.error('Failed to save document:', error)
              throw error
            }
          }}
        />
        </div>
      </div>
  )
}