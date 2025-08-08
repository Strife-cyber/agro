import { NextApiRequest, NextApiResponse } from 'next'
import { stackServerApp } from '@/stack'
import { prisma } from './prisma'

export interface AuthenticatedRequest extends NextApiRequest {
  user?: {
    id: string
    email: string
    name: string
    role: string
  }
}

export interface AuthResult {
  user?: {
    id: string
    email: string
    name: string
    role: string
  }
  error?: string
}

export type ApiHandler = (req: AuthenticatedRequest, res: NextApiResponse) => Promise<void> | void

export async function authenticateRequest(
  req: NextApiRequest
): Promise<AuthResult> {
  try {
    // Get the authorization header
    const authHeader = req.headers.authorization
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { error: 'Missing or invalid authorization header' }
    }

    // Verify the token with Stack
    const user = await stackServerApp.getUser()
    
    if (!user) {
      return { error: 'Invalid or expired token' }
    }

    // Get user details from database to get role
    const dbUser = await prisma?.users.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    })

    if (!dbUser) {
      return { error: 'User not found in database' }
    }

    return { 
      user: {
        id: dbUser.id,
        email: dbUser.email || '',
        name: dbUser.name || '',
        role: dbUser.role || 'client'
      }
    }
  } catch (error) {
    console.error('Authentication error:', error)
    return { error: 'Authentication failed' }
  }
}

export function withAuth(handler: ApiHandler): ApiHandler {
  return async (req: AuthenticatedRequest, res: NextApiResponse) => {
    const authResult = await authenticateRequest(req)
    
    if (authResult.error) {
      return res.status(401).json({
        error: authResult.error,
        code: 'UNAUTHORIZED',
      })
    }

    req.user = authResult.user
    return handler(req, res)
  }
}

export function withRoleAuth(allowedRoles: string[]) {
  return (handler: ApiHandler): ApiHandler => {
    return async (req: AuthenticatedRequest, res: NextApiResponse) => {
      const authResult = await authenticateRequest(req)
      
      if (authResult.error) {
        return res.status(401).json({
          error: authResult.error,
          code: 'UNAUTHORIZED',
        })
      }

      req.user = authResult.user

      // Check if user has required role
      if (!allowedRoles.includes(req.user?.role ?? '')) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          code: 'FORBIDDEN',
        })
      }

      return handler(req, res)
    }
  }
}
