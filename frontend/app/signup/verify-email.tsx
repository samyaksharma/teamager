'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import axios from 'axios'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle, XCircle, MailCheck } from 'lucide-react'

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="h-16 w-16 animate-pulse rounded-full bg-primary/20" />
      </div>
    }>
      <VerifyEmailInner />
    </Suspense>
  )
}

function VerifyEmailInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  
  const [verificationStatus, setVerificationStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('Verifying your email...')

  useEffect(() => {
    if (!token) {
      setVerificationStatus('error')
      setMessage('Invalid verification link. No token provided.')
      return
    }

    const verifyEmail = async () => {
      try {
        const response = await axios.get(`http://localhost:3001/api/verification/verify-email?token=${token}`)
        
        setVerificationStatus('success')
        setMessage('Your email has been successfully verified! You can now login to your account.')
      } catch (error: any) {
        console.error('Email verification failed:', error)
        
        setVerificationStatus('error')
        setMessage(error.response?.data?.message || 'Email verification failed. The link may be invalid or expired.')
      }
    }

    verifyEmail()
  }, [token])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Email Verification</CardTitle>
          <CardDescription>
            {verificationStatus === 'loading' ? 'Verifying your email address...' : 
             verificationStatus === 'success' ? 'Verification complete!' : 
             'Verification failed'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center space-y-4 pb-6">
          {verificationStatus === 'loading' && (
            <div className="flex flex-col items-center space-y-4">
              <div className="h-16 w-16 animate-pulse rounded-full bg-primary/20 flex items-center justify-center">
                <MailCheck className="h-8 w-8 text-primary" />
              </div>
              <p className="text-center text-sm text-muted-foreground">
                Please wait while we verify your email address...
              </p>
            </div>
          )}
          
          {verificationStatus === 'success' && (
            <div className="flex flex-col items-center space-y-4">
              <CheckCircle className="h-16 w-16 text-green-500" />
              <p className="text-center text-sm">{message}</p>
            </div>
          )}
          
          {verificationStatus === 'error' && (
            <div className="flex flex-col items-center space-y-4">
              <XCircle className="h-16 w-16 text-red-500" />
              <p className="text-center text-sm">{message}</p>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-center">
          {verificationStatus === 'success' && (
            <Button onClick={() => router.push('/login')} className="w-full">
              Go to Login
            </Button>
          )}
          
          {verificationStatus === 'error' && (
            <div className="flex w-full flex-col space-y-2">
              <Button 
                onClick={() => router.push('/signup')} 
                variant="secondary" 
                className="w-full"
              >
                Back to Sign Up
              </Button>
              <Button 
                onClick={() => router.push('/forgot-password')} 
                variant="outline" 
                className="w-full"
              >
                Reset Password
              </Button>
            </div>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}