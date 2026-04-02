import { sendEmail } from './email'

interface SessionNotificationData {
  userName: string
  email: string
  deviceName: string
  ipAddress: string
  location?: string
  action: 'LOGIN' | 'LOGOUT' | 'SESSION_REVOKED' | 'SESSION_REVOKED_ALL'
  timestamp: Date
}

export const sendSessionNotification = async (data: SessionNotificationData) => {
  try {
    const { userName, email, deviceName, ipAddress, action, timestamp } = data
    
    let subject: string
    let message: string
    
    const timeStr = timestamp.toLocaleString()
    const locationStr = data.location || 'Unknown location'
    
    switch (action) {
      case 'LOGIN':
        subject = '🔐 New login to your Teamager account'
        message = `
Hello ${userName},

We detected a new login to your Teamager account:

• Device: ${deviceName}
• IP Address: ${ipAddress}
• Location: ${locationStr}
• Time: ${timeStr}

If this was you, no action is needed. If you don't recognize this login, please:
1. Change your password immediately
2. Review your active sessions in Account Settings
3. Revoke any suspicious sessions

Stay secure,
The Teamager Team

---
This is an automated security notification.
        `.trim()
        break
        
      case 'SESSION_REVOKED':
        subject = '🛡️ A session was terminated on your Teamager account'
        message = `
Hello ${userName},

A session was terminated on your Teamager account:

• Device: ${deviceName}
• IP Address: ${ipAddress}
• Time: ${timeStr}

If you didn't perform this action, please check your account security immediately.

Best regards,
The Teamager Team

---
This is an automated security notification.
        `.trim()
        break
        
      case 'SESSION_REVOKED_ALL':
        subject = '🔒 All sessions were terminated on your Teamager account'
        message = `
Hello ${userName},

All other sessions have been terminated on your Teamager account for security.

• Initiated from: ${deviceName}
• IP Address: ${ipAddress}
• Time: ${timeStr}

If you didn't perform this action, please:
1. Change your password immediately
2. Enable two-factor authentication if available
3. Contact support if you need assistance

Stay secure,
The Teamager Team

---
This is an automated security notification.
        `.trim()
        break
        
      default:
        return // Unknown action, skip notification
    }
    
    await sendEmail(email, subject, message)
    
  } catch (error) {
    console.error('Error sending session notification:', error)
    // Don't throw - notifications should not break the main flow
  }
}

export const sendSuspiciousActivityAlert = async (
  userName: string,
  email: string,
  details: {
    deviceName: string
    ipAddress: string
    action: string
    timestamp: Date
  }
) => {
  try {
    const subject = '⚠️ Suspicious activity detected on your Teamager account'
    const message = `
Hello ${userName},

We detected potentially suspicious activity on your Teamager account:

• Activity: ${details.action}
• Device: ${details.deviceName}
• IP Address: ${details.ipAddress}
• Time: ${details.timestamp.toLocaleString()}

For your security, we recommend:
1. Review your recent account activity
2. Change your password if you don't recognize this activity
3. Check your active sessions and revoke any suspicious ones
4. Consider enabling additional security measures

If you need help securing your account, please contact our support team.

Stay safe,
The Teamager Security Team

---
This is an automated security alert.
    `.trim()
    
    await sendEmail(email, subject, message)
    
  } catch (error) {
    console.error('Error sending suspicious activity alert:', error)
  }
}