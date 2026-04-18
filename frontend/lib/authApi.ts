'use client'

import axios from 'axios'

import { config } from './config'

const API_URL = config.apiUrl

// Create separate auth-specific axios instance to avoid interceptor issues
const authAxios = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
  // Note: withCredentials will be set per-request as needed for refresh tokens
})

// Auth-related API calls in a separate file to prevent Fast Refresh issues
export const authApi = {
  login: async (email: string, password: string) => {
    try {
      const response = await authAxios.post('/api/user/login', { email, password }, { 
        withCredentials: true 
      })
      return response.data
    } catch (error) {
      // Ensure errors are properly thrown without redirecting
      throw error
    }
  },
  
  register: async (userData: any) => {
    try {
      const response = await authAxios.post('/api/auth/register', userData)
      return response.data
    } catch (error) {
      // Ensure errors are properly thrown without redirecting
      throw error
    }
  },
  
  verifyEmail: async (token: string) => {
    try {
      const response = await authAxios.get(`/api/verification/verify-email?token=${token}`)
      return response.data
    } catch (error) {
      throw error
    }
  },
  
  logout: async () => {
    try {
      const response = await authAxios.post('/api/user/logout', {}, { 
        withCredentials: true 
      })
      // HTTP-only cookies are cleared by the server, no localStorage cleanup needed for tokens
      return response.data
    } catch (error) {
      throw error
    }
  },
  
  forgotPassword: async (email: string) => {
    try {
      const response = await authAxios.post('/api/user/forgot-password', { email })
      return response.data
    } catch (error) {
      throw error
    }
  },
  
  resetPassword: async (token: string, password: string) => {
    try {
      const response = await authAxios.post('/api/user/reset-password', { token, password })
      return response.data
    } catch (error) {
      throw error
    }
  }
}

export default authApi