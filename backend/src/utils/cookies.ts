import type { CookieOptions } from 'express'

// Auth cookie settings, shared by every route that sets or clears them.
//
//  - Development (HTTP, localhost):      SameSite=Lax, not Secure.
//  - Production (HTTPS):                 Secure, and SameSite=None by default so the cookie also works when the
//                                         frontend and the API live on different domains.
//
// Override with COOKIE_SAMESITE=lax|strict|none (use "lax" when both are on the same site, for example
// app.example.com and api.example.com) and COOKIE_DOMAIN for a shared parent domain.
const isProduction = process.env.NODE_ENV === 'production'

const configured = (process.env.COOKIE_SAMESITE ?? '').toLowerCase()
const sameSite: 'lax' | 'strict' | 'none' =
  configured === 'lax' || configured === 'strict' || configured === 'none'
    ? configured
    : isProduction ? 'none' : 'lax'

// Browsers reject SameSite=None cookies that aren't Secure
const secure = isProduction || sameSite === 'none'

const base: CookieOptions = {
  httpOnly: true,
  secure,
  sameSite,
  ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {})
}

export const cookieOptions = (maxAgeMs: number): CookieOptions => ({ ...base, maxAge: maxAgeMs })

// A cookie is only cleared when the same attributes (except maxAge) are used to expire it
export const clearCookieOptions: CookieOptions = { ...base }
