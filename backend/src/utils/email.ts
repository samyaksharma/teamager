import nodemailer from 'nodemailer'

const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  })
}

export const sendVerificationEmail = async (email: string, token: string) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000'
  const verificationUrl = `${frontendUrl}/verify-email?token=${token}`
  
  // In development, log to console instead of sending email
  if (process.env.NODE_ENV !== 'production') {
    console.log('\n🔗 EMAIL VERIFICATION LINK (Development Mode):')
    console.log(`   Email: ${email}`)
    console.log(`   Verification URL: ${verificationUrl}`)
    console.log('   Copy this link to verify the account\n')
    return
  }

  // In production, send actual email
  const transporter = createTransporter()
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Verify your email address',
    html: `
      <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
        <h1 style="color: #333; text-align: center;">Welcome to Teamager!</h1>
        <p style="color: #666; font-size: 16px;">Please click the button below to verify your email address:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" 
             style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
            Verify Email
          </a>
        </div>
        <p style="color: #999; font-size: 14px;">If you didn't sign up for Teamager, you can safely ignore this email.</p>
      </div>
    `
  }

  await transporter.sendMail(mailOptions)
}

export const sendEmail = async (to: string, subject: string, text: string) => {
  // In development, log to console instead of sending email
  if (process.env.NODE_ENV !== 'production') {
    console.log('\n📧 EMAIL (Development Mode):')
    console.log(`   To: ${to}`)
    console.log(`   Subject: ${subject}`)
    console.log(`   Message: ${text}`)
    console.log('')
    return
  }

  // In production, send actual email
  const transporter = createTransporter()
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to,
    subject,
    text
  }

  await transporter.sendMail(mailOptions)
}

export const sendInvitationEmail = async (email: string, teamName: string, inviterName: string, token: string) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000'
  const invitationUrl = `${frontendUrl}/invite/${token}`
  
  // In development, log to console instead of sending email
  if (process.env.NODE_ENV !== 'production') {
    console.log('\n📧 TEAM INVITATION LINK (Development Mode):')
    console.log(`   Invited: ${email}`)
    console.log(`   Team: ${teamName}`)
    console.log(`   Inviter: ${inviterName}`)
    console.log(`   Invitation URL: ${invitationUrl}`)
    console.log('   Copy this link to accept the invitation\n')
    return
  }

  // In production, send actual email
  const transporter = createTransporter()
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: `You've been invited to join ${teamName}`,
    html: `
      <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
        <h1 style="color: #333; text-align: center;">Team Invitation</h1>
        <p style="color: #666; font-size: 16px;">
          <strong>${inviterName}</strong> has invited you to join the team <strong>${teamName}</strong> on Teamager.
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${invitationUrl}" 
             style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
            Accept Invitation
          </a>
        </div>
        <p style="color: #999; font-size: 14px;">This invitation will expire in 7 days.</p>
      </div>
    `
  }

  await transporter.sendMail(mailOptions)
}