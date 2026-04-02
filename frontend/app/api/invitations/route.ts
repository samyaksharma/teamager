import { NextResponse } from 'next/server'

// This is a stub for demo purposes only
export async function GET() {
  // In a real app, this would fetch pending invitations for the current user
  return NextResponse.json([
    {
      id: '1',
      token: 'abcdefg',
      role: 1,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      team: {
        id: '1',
        name: 'Acme Inc.'
      },
      inviter: {
        id: '1',
        name: 'John Doe'
      }
    }
  ])
}