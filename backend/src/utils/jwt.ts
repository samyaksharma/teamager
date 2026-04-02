import jwt from 'jsonwebtoken'

interface TokenPayload {
  userId: string
  email: string
}

export const generateAccessToken = (payload: TokenPayload): string => {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET environment variable not set')
  }

  return jwt.sign(payload, secret, { expiresIn: '3m' })
}

export const generateRefreshToken = (payload: TokenPayload): string => {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET environment variable not set')
  }

  return jwt.sign(payload, secret, { expiresIn: '7d' })
}

export const verifyRefreshToken = (token: string): TokenPayload => {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new Error('JWT_SECRET environment variable not set')
  }

  return jwt.verify(token, secret) as TokenPayload
}