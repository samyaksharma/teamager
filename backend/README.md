# Teamager Backend

A clean Express.js backend for the Teamager team collaboration platform.

## Features

- **Express.js** server with TypeScript
- **Drizzle ORM** with PostgreSQL
- **JWT Authentication** with refresh tokens
- **Email verification** and invitations
- **Separate WebSocket service** for real-time document collaboration
- **Clean architecture** with proper middleware and error handling

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Environment setup:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Database setup:**
   ```bash
   # Generate migrations
   npm run db:generate
   
   # Run migrations
   npm run db:migrate
   ```

4. **Start development:**
   ```bash
   # Main API server
   npm run dev
   
   # WebSocket service (in separate terminal)
   npm run websocket
   ```

## Scripts

- `npm run dev` - Start main API server in development mode (port 3001)
- `npm run document-service` - Start document service with WebSocket (port 3002)
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run websocket` - Start standalone WebSocket service for documents
- `npm run db:generate` - Generate database migrations
- `npm run db:migrate` - Run database migrations
- `npm run db:studio` - Open Drizzle Studio

## Architecture

### Main API Server (Port 3001)
- Authentication routes (`/api/auth`, `/api/user`, `/api/verification`)
- Organization management (`/api/organizations`)
- Team management (`/api/teams`)
- Task management (`/api/tasks`)
- Document CRUD (`/api/documents`) - fallback, primary on port 3002
- Channel/messaging (`/api/channels`)
- Direct messaging (`/api/direct-messages`)
- Invitation system (`/api/invitations`)

### Document Service (Port 3002)
- Document CRUD operations (`/documents`)
- Real-time document collaboration via WebSocket
- Separate process for better performance
- Automatic cleanup of inactive documents

## Complete API Endpoints

### Authentication & Users
- `POST /api/verification/register` - Register new user with organization
- `GET /api/verification/verify-email?token=` - Verify email address
- `POST /api/user/login` - Login user
- `POST /api/user/logout` - Logout user
- `POST /api/user/refresh-token` - Refresh access token
- `POST /api/user/forgot-password` - Request password reset
- `POST /api/user/reset-password` - Reset password with token
- `GET /api/user/me` - Get current user profile
- `PUT /api/user/me` - Update user profile

### Organizations
- `GET /api/organizations` - Get user's organizations
- `GET /api/organizations/:id` - Get organization details
- `POST /api/organizations` - Create new organization
- `PUT /api/organizations/:id` - Update organization
- `DELETE /api/organizations/:id` - Delete organization

### Teams
- `GET /api/teams` - Get user's teams
- `GET /api/teams/:id` - Get team details
- `GET /api/teams/:id/members` - Get team members
- `POST /api/teams` - Create new team
- `PUT /api/teams/:id` - Update team
- `POST /api/teams/:id/members` - Add team member
- `PUT /api/teams/:id/members/:userId` - Update member role
- `DELETE /api/teams/:id/members/:userId` - Remove team member

### Tasks
- `GET /api/tasks` - Get tasks (with query filters)
- `GET /api/tasks/:id` - Get task details
- `POST /api/tasks` - Create new task
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task

### Documents (Both servers)
- `GET /api/documents` or `GET localhost:3002/documents` - Get documents
- `GET /api/documents/:id` or `GET localhost:3002/documents/:id` - Get document
- `POST /api/documents` or `POST localhost:3002/documents` - Create document
- `PUT /api/documents/:id` or `PUT localhost:3002/documents/:id` - Update document
- `DELETE /api/documents/:id` or `DELETE localhost:3002/documents/:id` - Delete document

### Channels & Messaging
- `GET /api/channels?teamId=` - Get team channels
- `GET /api/channels/:id` - Get channel details
- `GET /api/channels/team/:teamId/default` - Get default channel
- `POST /api/channels` - Create channel
- `PUT /api/channels/:id` - Update channel
- `GET /api/channels/:id/messages` - Get channel messages
- `POST /api/channels/:id/messages` - Send channel message

### Direct Messages
- `GET /api/direct-messages` - Get all direct messages
- `GET /api/direct-messages/unread` - Get unread messages
- `GET /api/direct-messages/user/:userId` - Get conversation with user
- `POST /api/direct-messages/user/:userId` - Send message to user
- `PUT /api/direct-messages/:messageId/read` - Mark message as read
- `PUT /api/direct-messages/user/:userId/read-all` - Mark all messages from user as read
- `DELETE /api/direct-messages/:messageId` - Delete message

### Invitations
- `GET /api/invitations/my-invitations` - Get user's pending invitations
- `GET /api/invitations/validate/:token` - Validate invitation token
- `POST /api/invitations/accept/:token` - Accept invitation
- `POST /api/invitations/decline/:token` - Decline invitation
- `POST /api/invitations` - Send team invitation

## Database Schema

The database uses PostgreSQL with the following main tables:
- `users` - User accounts and profiles
- `organizations` - Company/organization data
- `teams` - Team information
- `team_users` - Team membership (junction table)
- `team_invitations` - Pending team invitations
- `tasks` - Task management
- `task_teams` - Task-team associations
- `documents` - Document metadata
- `direct_messages` - Direct messaging
- `channels` - Team channels
- `messages` - Channel messages

## Environment Variables

See `.env.example` for all required environment variables:

- Database connection
- JWT secrets
- Email configuration
- Server ports
- CORS settings