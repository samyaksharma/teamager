'use client'

import axios from 'axios'
import config from './config'

// Use localhost URLs for local development
const API_URL = config.apiUrl
const DOCUMENT_API_URL = config.documentServiceUrl

// Feature flag to disable separate document service if it's causing CORS issues
const USE_SEPARATE_DOCUMENT_SERVICE = false // Set to false to always use main API

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true // Send HTTP-only cookies with requests
})

// Add request interceptor (tokens are in HTTP-only cookies, sent automatically)
api.interceptors.request.use(
  (config) => {
    return config
  },
  (error) => Promise.reject(error)
)

// Add response interceptor to handle authentication errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // If 401 error, redirect to login (backend middleware handles token refresh automatically)
    if (error.response?.status === 401) {
      // Skip redirect for login/auth endpoints
      const isAuthEndpoint = error.config?.url?.includes('/api/user/login') || 
                             error.config?.url?.includes('/api/verification/register') ||
                             error.config?.url?.includes('/api/auth/login')
      
      if (!isAuthEndpoint && !window.location.pathname.includes('/login')) {
        window.location.href = '/login'
      }
    }
    
    return Promise.reject(error)
  }
)

// Auth-related API calls have been moved to a separate file to prevent Fast Refresh issues
// Import from lib/authApi.ts instead
export { authApi } from './authApi'

// Organization-related API calls
export const organizationsApi = {
  getAllOrganizations: async () => {
    const response = await api.get('/api/organizations')
    return response.data
  },
  
  getOrganization: async (orgId: string) => {
    const response = await api.get(`/api/organizations/${orgId}`)
    return response.data
  },
  
  createOrganization: async (orgData: {
    name: string
    industry?: string
    size?: string
    role?: string
    department?: string
    jobTitle?: string
  }) => {
    const response = await api.post('/api/organizations', orgData)
    return response.data
  },
  
  updateOrganization: async (orgId: string, data: {
    name?: string
    industry?: string
    size?: string
  }) => {
    const response = await api.put(`/api/organizations/${orgId}`, data)
    return response.data
  },
  
  deleteOrganization: async (orgId: string) => {
    const response = await api.delete(`/api/organizations/${orgId}`)
    return response.data
  }
}

// Document-related API calls
export const documentsApi = {
  // Alias for getAllDocuments for backward compatibility
  getDocuments: async (teamId?: string) => {
    try {
      // Try to connect directly to the document service first
      if (USE_SEPARATE_DOCUMENT_SERVICE && DOCUMENT_API_URL && DOCUMENT_API_URL !== API_URL) {
        try {
          const url = teamId 
            ? `${DOCUMENT_API_URL}/documents?teamId=${teamId}`
            : `${DOCUMENT_API_URL}/documents`;
          
          const response = await axios.get(url, {
            withCredentials: true // Use cookies instead of Authorization header
          });
          return response.data;
        } catch (docServiceError) {
          // Fall through to main API
        }
      }
      
      // Fallback to main API
      const url = teamId 
        ? `/api/documents?teamId=${teamId}`
        : '/api/documents';
        
      const response = await api.get(url);
      return response.data;
    } catch (error) {
      return [] // Return empty array instead of throwing
    }
  },
  getAllDocuments: async () => {
    try {
      // Try to connect directly to the document service first
      if (USE_SEPARATE_DOCUMENT_SERVICE && DOCUMENT_API_URL && DOCUMENT_API_URL !== API_URL) {
        try {
          const response = await axios.get(`${DOCUMENT_API_URL}/documents`, {
            withCredentials: true
          })
          return response.data
        } catch (docServiceError) {
          // Fall through to main API
        }
      }
      
      // Fallback to main API
      const response = await api.get('/api/documents')
      return response.data
    } catch (error) {
      return [] // Return empty array instead of throwing
    }
  },
  
  getDocument: async (documentId: string) => {
    try {
      // Try to connect directly to the document service first
      if (USE_SEPARATE_DOCUMENT_SERVICE && DOCUMENT_API_URL && DOCUMENT_API_URL !== API_URL) {
        try {
          const response = await axios.get(`${DOCUMENT_API_URL}/documents/${documentId}`, {
            withCredentials: true
          })
          return response.data
        } catch (docServiceError) {
          // Fall through to main API
        }
      }
      
      // Fallback to main API
      const response = await api.get(`/api/documents/${documentId}`)
      return response.data
    } catch (error) {
      throw error
    }
  },
  
  createDocument: async (documentData: any) => {
    try {
      // Try to connect directly to the document service first
      if (USE_SEPARATE_DOCUMENT_SERVICE && DOCUMENT_API_URL && DOCUMENT_API_URL !== API_URL) {
        try {
          const response = await axios.post(`${DOCUMENT_API_URL}/documents`, documentData, {
            withCredentials: true
          })
          return response.data
        } catch (docServiceError) {
          // Fall through to main API
        }
      }
      
      // Fallback to main API
      const response = await api.post('/api/documents', documentData)
      return response.data
    } catch (error) {
      throw error
    }
  },
  
  updateDocument: async (documentId: string, data: any) => {
    try {
      // Try to connect directly to the document service first
      if (USE_SEPARATE_DOCUMENT_SERVICE && DOCUMENT_API_URL && DOCUMENT_API_URL !== API_URL) {
        try {
          const response = await axios.put(`${DOCUMENT_API_URL}/documents/${documentId}`, data, {
            withCredentials: true
          })
          return response.data
        } catch (docServiceError) {
          // Fall through to main API
        }
      }
      
      // Fallback to main API
      const response = await api.put(`/api/documents/${documentId}`, data)
      return response.data
    } catch (error) {
      throw error
    }
  },
  
  deleteDocument: async (documentId: string) => {
    try {
      // Try to connect directly to the document service first
      if (USE_SEPARATE_DOCUMENT_SERVICE && DOCUMENT_API_URL && DOCUMENT_API_URL !== API_URL) {
        try {
          const response = await axios.delete(`${DOCUMENT_API_URL}/documents/${documentId}`, {
            withCredentials: true
          })
          return response.data
        } catch (docServiceError) {
          // Fall through to main API
        }
      }
      
      // Fallback to main API
      const response = await api.delete(`/api/documents/${documentId}`)
      return response.data
    } catch (error) {
      throw error
    }
  },

  // WebRTC access verification
  verifyDocumentAccess: async (documentId: string) => {
    try {
      // Try to connect directly to the document service first
      if (USE_SEPARATE_DOCUMENT_SERVICE && DOCUMENT_API_URL && DOCUMENT_API_URL !== API_URL) {
        try {
          const response = await axios.post(`${DOCUMENT_API_URL}/documents/${documentId}/verify-access`, {}, {
            withCredentials: true
          })
          return response.data
        } catch (docServiceError) {
          // Fall through to main API
        }
      }
      
      // Fallback to main API
      const response = await api.post(`/api/documents/${documentId}/verify-access`)
      return response.data
    } catch (error) {
      throw error
    }
  },

  // Document permission management
  getDocumentPermissions: async (documentId: string) => {
    try {
      // Try to connect directly to the document service first
      if (USE_SEPARATE_DOCUMENT_SERVICE && DOCUMENT_API_URL && DOCUMENT_API_URL !== API_URL) {
        try {
          const response = await axios.get(`${DOCUMENT_API_URL}/documents/${documentId}/permissions`, {
            withCredentials: true
          })
          return response.data
        } catch (docServiceError) {
          // Fall through to main API
        }
      }
      
      // Fallback to main API
      const response = await api.get(`/api/documents/${documentId}/permissions`)
      return response.data
    } catch (error) {
      throw error
    }
  },

  assignDocumentRole: async (documentId: string, assignmentData: {
    userId?: string,
    teamId?: string,
    role: 'viewer' | 'commenter' | 'editor' | 'admin'
  }) => {
    try {
      // Try to connect directly to the document service first
      if (USE_SEPARATE_DOCUMENT_SERVICE && DOCUMENT_API_URL && DOCUMENT_API_URL !== API_URL) {
        try {
          const response = await axios.post(`${DOCUMENT_API_URL}/documents/${documentId}/permissions`, assignmentData, {
            withCredentials: true
          })
          return response.data
        } catch (docServiceError) {
          // Fall through to main API
        }
      }
      
      // Fallback to main API
      const response = await api.post(`/api/documents/${documentId}/permissions`, assignmentData)
      return response.data
    } catch (error) {
      throw error
    }
  },

  removeDocumentRole: async (documentId: string, removalData: {
    userId?: string,
    teamId?: string
  }) => {
    try {
      const params = new URLSearchParams()
      if (removalData.userId) params.append('userId', removalData.userId)
      if (removalData.teamId) params.append('teamId', removalData.teamId)
      
      // Try to connect directly to the document service first
      if (USE_SEPARATE_DOCUMENT_SERVICE && DOCUMENT_API_URL && DOCUMENT_API_URL !== API_URL) {
        try {
          const response = await axios.delete(`${DOCUMENT_API_URL}/documents/${documentId}/permissions?${params.toString()}`, {
            withCredentials: true
          })
          return response.data
        } catch (docServiceError) {
          // Fall through to main API
        }
      }
      
      // Fallback to main API
      const response = await api.delete(`/api/documents/${documentId}/permissions?${params.toString()}`)
      return response.data
    } catch (error) {
      throw error
    }
  }
}

// Task-related API calls
export const tasksApi = {
  getAllTasks: async (params?: { 
    teamId?: string, 
    organizationId?: string,
    assignedTo?: string,
    status?: number
  }) => {
    const queryParams = new URLSearchParams();
    
    if (params?.teamId) queryParams.append('teamId', params.teamId);
    if (params?.organizationId) queryParams.append('organizationId', params.organizationId);
    if (params?.assignedTo) queryParams.append('assignedTo', params.assignedTo);
    if (params?.status !== undefined) queryParams.append('status', params.status.toString());
    
    const queryString = queryParams.toString();
    const url = queryString ? `/api/tasks?${queryString}` : '/api/tasks';
    
    const response = await api.get(url);
    return response.data;
  },
  
  getTask: async (taskId: string) => {
    const response = await api.get(`/api/tasks/${taskId}`);
    return response.data;
  },
  
  createTask: async (taskData: {
    title: string,
    description?: string,
    priority?: number,
    status?: number,
    dueDate?: Date | string | null,
    assignedTo?: string | null,
    // Legacy support
    teamId?: string,
    // New multi-team support
    teamIds?: string[],
    organizationId?: string
  }) => {
    const response = await api.post('/api/tasks', taskData);
    return response.data;
  },
  
  updateTask: async (taskId: string, data: {
    title?: string,
    description?: string,
    priority?: number,
    status?: number,
    dueDate?: Date | string | null,
    assignedTo?: string | null,
    teamId?: string,
    teamIds?: string[],
    organizationId?: string
  }) => {
    const response = await api.put(`/api/tasks/${taskId}`, data);
    return response.data;
  },
  
  deleteTask: async (taskId: string) => {
    const response = await api.delete(`/api/tasks/${taskId}`);
    return response.data;
  },
  
  // New methods for organization and team-specific task management
  getOrganizationTasks: async (organizationId: string) => {
    return tasksApi.getAllTasks({ organizationId });
  },
  
  getTeamTasks: async (teamId: string) => {
    return tasksApi.getAllTasks({ teamId });
  }
}

// Channel-related API calls
export const channelsApi = {
  getAllChannels: async (teamId: string) => {
    const response = await api.get(`/api/channels?teamId=${teamId}`)
    return response.data
  },

  getChannel: async (channelId: string) => {
    const response = await api.get(`/api/channels/${channelId}`)
    return response.data
  },

  getDefaultChannel: async (teamId: string) => {
    const response = await api.get(`/api/channels/team/${teamId}/default`)
    return response.data
  },

  createChannel: async (channelData: {
    name: string
    description?: string
    teamId: string
    type?: number
    isPrivate?: boolean
  }) => {
    const response = await api.post('/api/channels', channelData)
    return response.data
  },

  updateChannel: async (channelId: string, channelData: {
    name?: string
    description?: string
    isPrivate?: boolean
    type?: number
  }) => {
    const response = await api.put(`/api/channels/${channelId}`, channelData)
    return response.data
  },

  getMessages: async (channelId: string, limit?: number) => {
    const url = limit
      ? `/api/channels/${channelId}/messages?limit=${limit}`
      : `/api/channels/${channelId}/messages`
    const response = await api.get(url)
    return response.data
  },

  sendMessage: async (channelId: string, content: string) => {
    const response = await api.post(`/api/channels/${channelId}/messages`, { content })
    return response.data
  },

  canCreateChannel: async (teamId: string) => {
    const response = await api.get(`/api/channels/can-create/${teamId}`)
    return response.data
  },

  addAllTeamMembers: async (channelId: string, teamId: string) => {
    const response = await api.post(`/api/channels/${channelId}/add-team-members`, { teamId })
    return response.data
  }
}

// Direct Message-related API calls
export const directMessagesApi = {
  getAllMessages: async (limit?: number) => {
    const url = limit
      ? `/api/direct-messages?limit=${limit}`
      : '/api/direct-messages'
    const response = await api.get(url)
    return response.data
  },

  getUnreadMessages: async () => {
    const response = await api.get('/api/direct-messages/unread')
    return response.data
  },

  getMessagesWithUser: async (userId: string, limit?: number) => {
    const url = limit
      ? `/api/direct-messages/user/${userId}?limit=${limit}`
      : `/api/direct-messages/user/${userId}`
    const response = await api.get(url)
    return response.data
  },

  sendMessage: async (userId: string, content: string) => {
    const response = await api.post(`/api/direct-messages/user/${userId}`, { content })
    return response.data
  },

  markAsRead: async (messageId: string) => {
    const response = await api.put(`/api/direct-messages/${messageId}/read`)
    return response.data
  },

  markAllAsRead: async (userId: string) => {
    const response = await api.put(`/api/direct-messages/user/${userId}/read-all`)
    return response.data
  },

  deleteMessage: async (messageId: string) => {
    const response = await api.delete(`/api/direct-messages/${messageId}`)
    return response.data
  }
}

// User-related API calls
export const usersApi = {
  getCurrentUser: async () => {
    const response = await api.get('/api/user/me')
    return response.data
  },
  
  updateProfile: async (userData: any) => {
    const response = await api.put('/api/user/me', userData)
    return response.data
  }
}

// Invitation-related API calls
export const invitationsApi = {
  getMyInvitations: async () => {
    const response = await api.get('/api/invitations/my-invitations')
    return response.data
  },
  
  getSentInvitations: async () => {
    const response = await api.get('/api/invitations/sent')
    return response.data
  },
  
  acceptInvitation: async (token: string) => {
    const response = await api.post(`/api/invitations/accept/${token}`)
    return response.data
  },
  
  declineInvitation: async (token: string) => {
    const response = await api.post(`/api/invitations/decline/${token}`)
    return response.data
  },
  
  createInvitation: async (invitationData: {
    email: string,
    organizationId: string,
    role?: string,
    department?: string,
    jobTitle?: string
  }) => {
    const response = await api.post('/api/invitations', invitationData)
    return response.data
  },
  
  cancelInvitation: async (invitationId: string) => {
    const response = await api.delete(`/api/invitations/${invitationId}`)
    return response.data
  },
  
  resendInvitation: async (invitationId: string) => {
    const response = await api.post(`/api/invitations/${invitationId}/resend`)
    return response.data
  }
}

// Team-related API calls
export const teamApi = {
  getTeams: async () => {
    const response = await api.get('/api/teams');
    return response.data.teams || [];
  },
  
  getTeam: async (teamId: string) => {
    const response = await api.get(`/api/teams/${teamId}`);
    return response.data;
  },
  
  createTeam: async (teamData: {
    name: string,
    description?: string,
    organizationId?: string
  }) => {
    const response = await api.post('/api/teams', teamData);
    return response.data;
  },
  
  updateTeam: async (teamId: string, teamData: {
    name?: string,
    description?: string
  }) => {
    const response = await api.put(`/api/teams/${teamId}`, teamData);
    return response.data;
  },
  
  deleteTeam: async (teamId: string) => {
    const response = await api.delete(`/api/teams/${teamId}`);
    return response.data;
  },
  
  getMembers: async (teamId: string) => {
    const response = await api.get(`/api/teams/${teamId}/members`);
    return response.data;
  },
  
  addMember: async (teamId: string, memberData: {
    userId?: string,
    email?: string,
    role?: string
  }) => {
    const response = await api.post(`/api/teams/${teamId}/members`, memberData);
    return response.data;
  },
  
  removeMember: async (teamId: string, memberId: string) => {
    const response = await api.delete(`/api/teams/${teamId}/members/${memberId}`);
    return response.data;
  },
  
  searchUsers: async (query: string, limit = 10) => {
    const response = await api.get(`/api/user/search?q=${encodeURIComponent(query)}&limit=${limit}`);
    return response.data;
  }
}

// For backward compatibility
export const teamAPI = teamApi;

export default api