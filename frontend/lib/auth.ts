/**
 * Authentication utilities and guards
 * Updated for HTTP-only cookie authentication system
 */

import { usersApi } from './api'
import { authApi } from './authApi'

export const isAuthenticated = async (): Promise<boolean> => {
  if (typeof window === 'undefined') return false
  
  try {
    // With HTTP-only cookies, we need to check with the server
    // The tokens are stored in secure cookies, not accessible via JavaScript
    await usersApi.getCurrentUser()
    return true
  } catch (error) {
    // If getCurrentUser fails, user is not authenticated
    return false
  }
}

export const logout = async () => {
  try {
    // Call backend logout to clear HTTP-only refresh token cookie
    await authApi.logout()
  } catch (error) {
  }
  
  // HTTP-only cookies are cleared by the server, no localStorage cleanup needed for tokens
  // Only clear user data from localStorage
  localStorage.removeItem('user')
  window.location.href = '/login'
}

export const redirectToLogin = () => {
  const currentPath = window.location.pathname
  const redirectUrl = currentPath !== '/login' ? `?redirect=${encodeURIComponent(currentPath)}` : ''
  window.location.href = `/login${redirectUrl}`
}

export const checkAuthAndRedirect = async (): Promise<boolean> => {
  try {
    // Verify authentication with server using HTTP-only cookies
    await usersApi.getCurrentUser()
    return true
  } catch (error) {
    // Token is invalid or server error
    redirectToLogin()
    return false
  }
}