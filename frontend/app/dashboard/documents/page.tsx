'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, PlusCircle, Clock, Calendar, Search, Users, MoreHorizontal, Trash2 } from 'lucide-react';
import { teamAPI, documentsApi as documentAPI } from '@/lib/api';
import DocumentPermissionsDialog from '@/components/document-permissions-dialog';
import { useOpenNew } from '@/lib/open-new';
import { BLANK_TEMPLATE_ID, DOCUMENT_TEMPLATES, getTemplate } from '@/lib/document-templates';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface Team {
  id: string;
  name: string;
}

interface Document {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string | null;
  teamId: string | null;
  authorName: string;
  teamName: string | null;
  ownerId?: string;
  permissions?: {
    canView: boolean;
    canEdit: boolean;
    canAdmin: boolean;
    canShare: boolean;
    canDelete: boolean;
    effectiveRole: string | null;
  };
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<string>('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  useOpenNew('document', () => setIsCreateDialogOpen(true));
  const [newDocTitle, setNewDocTitle] = useState('');
  const [newDocTeam, setNewDocTeam] = useState<string>('personal');
  const [templateId, setTemplateId] = useState<string>(BLANK_TEMPLATE_ID);
  // True while the title is the one we suggested from the template (so picking another template can replace it)
  const [titleIsSuggested, setTitleIsSuggested] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchTeams();
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [selectedTeam]);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      let response;

      if (selectedTeam && selectedTeam !== 'all') {
        const teamId = selectedTeam === 'personal' ? null : selectedTeam;
        response = await documentAPI.getDocuments(teamId);
      } else {
        response = await documentAPI.getDocuments();
      }

      const docs = response?.data || response || [];

      setDocuments(Array.isArray(docs) ? docs : []);
      setError(null);
    } catch (err) {
      setError('Failed to load documents. Please try again.');
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeams = async () => {
    try {
      const response = await teamAPI.getTeams();
      setTeams(response.data || response || []);
    } catch (err) {
    }
  };

  const handleCreateDocument = async () => {
    if (!newDocTitle.trim()) {
      return;
    }

    try {
      setLoading(true);
      const docData = {
        title: newDocTitle,
        content: getTemplate(templateId).build(new Date()),
        teamId: newDocTeam === "personal" ? null : newDocTeam || null
      };

      const response = await documentAPI.createDocument(docData);

      const newDocument = response.data || response;

      await fetchDocuments();

      setNewDocTitle('');
      setNewDocTeam('personal');
      setTemplateId(BLANK_TEMPLATE_ID);
      setTitleIsSuggested(true);
      setIsCreateDialogOpen(false);

      router.push(`/dashboard/documents/${newDocument.id}`);
    } catch (err) {
      setError(`Failed to create document: ${err.response?.data?.message || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTemplate = (id: string) => {
    setTemplateId(id);
    if (!newDocTitle.trim() || titleIsSuggested) {
      setNewDocTitle(id === BLANK_TEMPLATE_ID ? '' : getTemplate(id).defaultTitle(new Date()));
      setTitleIsSuggested(true);
    }
  };

  const navigateToDocument = (docId: string) => {
    router.push(`/dashboard/documents/${docId}`);
  };

  const handleDeleteDocument = async (docId: string, docTitle: string) => {
    if (!confirm(`Are you sure you want to delete "${docTitle}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setLoading(true);
      await documentAPI.deleteDocument(docId);

      await fetchDocuments();
    } catch (err: any) {
      setError(`Failed to delete document: ${err.response?.data?.message || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const filteredDocuments = Array.isArray(documents)
    ? documents.filter(doc =>
      doc?.title?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    : [];

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6 px-2 md:px-4">
        <h1 className="text-3xl font-bold">Documents</h1>

        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <PlusCircle size={18} />
              Create Document
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Document</DialogTitle>
              <DialogDescription>
                Create a new document to collaborate with your team.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Template</Label>
                <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Template">
                  {DOCUMENT_TEMPLATES.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      role="radio"
                      aria-checked={templateId === template.id}
                      onClick={() => handleSelectTemplate(template.id)}
                      className={`rounded-md border p-3 text-left text-sm transition-colors hover:bg-muted/60 ${
                        templateId === template.id ? 'border-primary bg-muted' : ''
                      }`}
                    >
                      <div className="font-medium">{template.name}</div>
                      <div className="text-xs text-muted-foreground">{template.description}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="doc-title" className="text-right">Title</Label>
                <Input
                  id="doc-title"
                  value={newDocTitle}
                  onChange={(e) => {
                    setNewDocTitle(e.target.value);
                    setTitleIsSuggested(false);
                  }}
                  className="col-span-3"
                  placeholder="Enter document title"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="doc-team" className="text-right">Team</Label>
                <Select value={newDocTeam} onValueChange={setNewDocTeam}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select a team (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="personal">Personal Document</SelectItem>
                    {teams?.map(team => (
                      <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreateDocument} disabled={!newDocTitle.trim() || loading}>
                Create Document
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={18} />
          <Input
            placeholder="Search documents by title..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={selectedTeam} onValueChange={setSelectedTeam}>
          <SelectTrigger className="w-full md:w-[200px]">
            <SelectValue placeholder="Filter by team" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Documents</SelectItem>
            <SelectItem value="personal">Personal Documents</SelectItem>
            {teams?.map(team => (
              <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && (
        <div className="bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-200 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <CardHeader className="pb-2">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-16 w-full" />
              </CardContent>
              <CardFooter>
                <Skeleton className="h-10 w-full" />
              </CardFooter>
            </Card>
          ))
        ) : filteredDocuments.length > 0 ? (
          filteredDocuments.map(doc => (
            <Card key={doc.id} className="overflow-hidden hover:border-primary/50 transition-colors">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-lg">
                  <div
                    className="flex items-center gap-2 cursor-pointer flex-1"
                    onClick={() => navigateToDocument(doc.id)}
                  >
                    <FileText size={18} />
                    {doc.title}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => navigateToDocument(doc.id)}>
                        <FileText className="h-4 w-4 mr-2" />
                        Open Document
                      </DropdownMenuItem>
                      {(doc.permissions?.canShare || doc.permissions?.effectiveRole === 'owner' || doc.permissions?.canAdmin) && (
                        <>
                          <DropdownMenuSeparator />
                          <DocumentPermissionsDialog
                            documentId={doc.id}
                            canManagePermissions={doc.permissions?.canShare || doc.permissions?.effectiveRole === 'owner' || doc.permissions?.canAdmin}
                            trigger={
                              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                <Users className="h-4 w-4 mr-2" />
                                Manage Permissions
                              </DropdownMenuItem>
                            }
                          />
                        </>
                      )}
                      {doc.permissions?.canDelete && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDeleteDocument(doc.id, doc.title)}
                            className="text-red-600 focus:text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Document
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardTitle>
                <CardDescription>
                  {doc.teamName ? `Team: ${doc.teamName}` : 'Personal Document'}
                </CardDescription>
              </CardHeader>
              <CardContent
                className="pb-2 cursor-pointer"
                onClick={() => navigateToDocument(doc.id)}
              >
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock size={14} />
                  <span>Last updated: {formatDate(doc.updatedAt)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                  <Calendar size={14} />
                  <span>Created: {formatDate(doc.createdAt)}</span>
                </div>
              </CardContent>
              <CardFooter
                className="text-sm text-muted-foreground cursor-pointer"
                onClick={() => navigateToDocument(doc.id)}
              >
                By: {doc.authorName}
                {doc.permissions?.effectiveRole && (
                  <span className="ml-2 text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
                    {doc.permissions.effectiveRole === 'owner' ? 'Owner' : doc.permissions.effectiveRole}
                  </span>
                )}
              </CardFooter>
            </Card>
          ))
        ) : (
          <div className="col-span-3 text-center py-12">
            <h2 className="text-xl font-semibold mb-2">No documents found</h2>
            <p className="text-muted-foreground mb-6">
              {searchTerm
                ? `No documents matching "${searchTerm}"`
                : selectedTeam && selectedTeam !== 'all'
                  ? selectedTeam === 'personal' ? "No personal documents" : "No documents in this team"
                  : "Create your first document to get started"}
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)} className="flex items-center gap-2">
              <PlusCircle size={18} />
              Create Your First Document
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}