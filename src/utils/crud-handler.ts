/* eslint-disable @typescript-eslint/no-explicit-any */
// src/utils/crudHandler.ts
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { PrismaClient } from '@/generated/prisma'
import { NextApiRequest, NextApiResponse } from 'next'

// Get type-safe keys from PrismaClient that map to model delegates
type ModelKeys = Extract<keyof PrismaClient, string>

// Base validation schemas for common operations
const baseValidationSchemas = {
  id: z.string().uuid(),
  pagination: z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
  }),
  search: z.object({
    query: z.string().min(1).optional(),
    filters: z.record(z.any()).optional(),
  }),
}

// Error response interface
interface ErrorResponse {
  error: string
  code: string
  details?: any
}

// Success response interface
interface SuccessResponse<T> {
  data: T
  message: string
  pagination?: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// CRUD Handler configuration
interface CrudHandlerConfig {
  model: ModelKeys
  prisma: PrismaClient
  validationSchema?: z.ZodSchema
  allowedRoles?: string[]
  enablePagination?: boolean
  enableSearch?: boolean
  enableSoftDelete?: boolean
  auditLog?: boolean
}

// Rate limiting store (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

// Rate limiting function
function checkRateLimit(ip: string, limit: number = 100, windowMs: number = 15 * 60 * 1000): boolean {
  const now = Date.now()
  const key = `rate_limit:${ip}`
  const record = rateLimitStore.get(key)

  if (!record || now > record.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs })
    return true
  }

  if (record.count >= limit) {
    return false
  }

  record.count++
  return true
}

// Input sanitization
function sanitizeInput(input: any): any {
  if (typeof input === 'string') {
    return input.trim().replace(/[<>]/g, '')
  }
  if (typeof input === 'object' && input !== null) {
    const sanitized: any = {}
    for (const [key, value] of Object.entries(input)) {
      sanitized[key] = sanitizeInput(value)
    }
    return sanitized
  }
  return input
}

// Authorization check
async function checkAuthorization(
  req: NextApiRequest,
  allowedRoles?: string[]
): Promise<{ authorized: boolean; user?: any; error?: string }> {
  try {
    // Get user data from middleware headers
    const userId = req.headers['x-user-id'] as string

    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        created_at: true,
        updated_at: true,
      },
    });
    
    if (!user) {
      return { authorized: false, error: 'Authentication required' }
    }

    // Check role-based access control
    if (allowedRoles && allowedRoles.length > 0) {
      const userRole = user.role || 'client'
      if (!allowedRoles.includes(userRole)) {
        return { authorized: false, error: 'Insufficient permissions' }
      }
    }

    return { authorized: true, user }
  } catch (error) {
    console.error('Authorization check failed:', error)
    return { authorized: false, error: 'Authorization check failed' }
  }
}

// Audit logging
async function logAuditAction(
  prisma: PrismaClient,
  action: string,
  entityType: string,
  entityId: string,
  userId?: string,
  details?: any
) {
  try {
    await prisma.transaction_logs.create({
      data: {
        entity_type: entityType as any,
        entity_id: entityId,
        action: action as any,
        details: details || {},
        user_id: userId,
      },
    })
  } catch (error) {
    console.error('Audit logging failed:', error)
  }
}

// Enhanced CRUD handler
export const createCrudHandler = (config: CrudHandlerConfig) => {
  return async function handler(req: NextApiRequest, res: NextApiResponse) {
    const startTime = Date.now()

    try {
      // Rate limiting
      const clientIp = req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown'
      if (!checkRateLimit(clientIp)) {
        return res.status(429).json({
          error: 'Too many requests',
          code: 'RATE_LIMIT_EXCEEDED',
        } as ErrorResponse)
      }

      // Authorization check
      const authResult = await checkAuthorization(req, config.allowedRoles)
      if (!authResult.authorized) {
        return res.status(401).json({
          error: authResult.error || 'Unauthorized',
          code: 'UNAUTHORIZED',
        } as ErrorResponse)
      }

      // Sanitize input
      const sanitizedBody = sanitizeInput(req.body)
      const sanitizedQuery = sanitizeInput(req.query)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const delegate = config.prisma[config.model] as any

      switch (req.method) {
        case 'GET':
          return await handleGet(req, res, delegate, config, sanitizedQuery)

        case 'POST':
          return await handlePost(req, res, delegate, config, sanitizedBody, authResult.user)

        case 'PUT':
          return await handlePut(req, res, delegate, config, sanitizedBody, authResult.user)

        case 'DELETE':
          return await handleDelete(req, res, delegate, config, sanitizedBody, authResult.user)

        default:
          return res.status(405).json({
            error: 'Method Not Allowed',
            code: 'METHOD_NOT_ALLOWED',
          } as ErrorResponse)
      }
    } catch (error) {
      console.error(`CRUD Handler Error [${config.model}]:`, error)
      
      // Don't expose internal errors in production
      const isProduction = process.env.NODE_ENV === 'production'
      const errorMessage = isProduction ? 'Internal Server Error' : error instanceof Error ? error.message : 'Unknown error'
      
      return res.status(500).json({
        error: errorMessage,
        code: 'INTERNAL_SERVER_ERROR',
        ...(isProduction ? {} : { details: error }),
      } as ErrorResponse)
    } finally {
      const duration = Date.now() - startTime
      console.log(`${req.method} ${req.url} - ${duration}ms`)
    }
  }
}

// GET handler with pagination and search
async function handleGet(
  req: NextApiRequest,
  res: NextApiResponse,
  delegate: any,
  config: CrudHandlerConfig,
  query: any
) {
  try {
    const { id } = query

    // Single record by ID
    if (id) {
      const record = await delegate.findUnique({
        where: { id },
      })

      if (!record) {
        return res.status(404).json({
          error: 'Record not found',
          code: 'NOT_FOUND',
        } as ErrorResponse)
      }

      return res.status(200).json({
        data: record,
        message: 'Record retrieved successfully',
      } as SuccessResponse<any>)
    }

    // Multiple records with pagination
    if (config.enablePagination) {
      const pagination = baseValidationSchemas.pagination.parse(query)
      const skip = (pagination.page - 1) * pagination.limit

      const [records, total] = await Promise.all([
        delegate.findMany({
          skip,
          take: pagination.limit,
          orderBy: { created_at: 'desc' },
        }),
        delegate.count(),
      ])

      return res.status(200).json({
        data: records,
        message: 'Records retrieved successfully',
        pagination: {
          page: pagination.page,
          limit: pagination.limit,
          total,
          totalPages: Math.ceil(total / pagination.limit),
        },
      } as SuccessResponse<any>)
    }

    // Simple findMany without pagination
    const records = await delegate.findMany({
      orderBy: { created_at: 'desc' },
    })

    return res.status(200).json({
      data: records,
      message: 'Records retrieved successfully',
    } as SuccessResponse<any>)
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid query parameters',
        code: 'VALIDATION_ERROR',
        details: error.errors,
      } as ErrorResponse)
    }
    throw error
  }
}

// POST handler with validation
async function handlePost(
  req: NextApiRequest,
  res: NextApiResponse,
  delegate: any,
  config: CrudHandlerConfig,
  body: any,
  user: any
) {
  try {
    // Validate input if schema provided
    let validatedData = body
    if (config.validationSchema) {
      validatedData = config.validationSchema.parse(body)
    }

    // Add audit fields
    const dataWithAudit = {
      ...validatedData,
      created_at: new Date(),
      updated_at: new Date(),
    }

    const created = await delegate.create({ data: dataWithAudit })

    // Audit logging
    if (config.auditLog) {
      await logAuditAction(
        config.prisma,
        'CREATE',
        config.model,
        created.id || created[`${config.model}_id`],
        user?.id,
        { data: validatedData }
      )
    }

    return res.status(201).json({
      data: created,
      message: 'Record created successfully',
    } as SuccessResponse<any>)
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid input data',
        code: 'VALIDATION_ERROR',
        details: error.errors,
      } as ErrorResponse)
    }
    throw error
  }
}

// PUT handler with validation
async function handlePut(
  req: NextApiRequest,
  res: NextApiResponse,
  delegate: any,
  config: CrudHandlerConfig,
  body: any,
  user: any
) {
  try {
    const { id, ...updateData } = body

    if (!id) {
      return res.status(400).json({
        error: 'ID is required for updates',
        code: 'MISSING_ID',
      } as ErrorResponse)
    }

    // Validate input if schema provided
    let validatedData = updateData
    if (config.validationSchema) {
      // Use .extend({}).partial() for partial validation on update (workaround for ZodType)
      if (typeof (config.validationSchema as any).partial === 'function') {
        validatedData = (config.validationSchema as any).partial().parse(updateData)
      } else {
        // fallback: skip partial validation if not supported
        validatedData = config.validationSchema.parse(updateData)
      }
    }

    // Add audit fields
    const dataWithAudit = {
      ...validatedData,
      updated_at: new Date(),
    }

    const updated = await delegate.update({
      where: { id },
      data: dataWithAudit,
    })

    // Audit logging
    if (config.auditLog) {
      await logAuditAction(
        config.prisma,
        'UPDATE',
        config.model,
        id,
        user?.id,
        { data: validatedData }
      )
    }

    return res.status(200).json({
      data: updated,
      message: 'Record updated successfully',
    } as SuccessResponse<any>)
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid input data',
        code: 'VALIDATION_ERROR',
        details: error.errors,
      } as ErrorResponse)
    }
    throw error
  }
}

// DELETE handler with soft delete option
async function handleDelete(
  req: NextApiRequest,
  res: NextApiResponse,
  delegate: any,
  config: CrudHandlerConfig,
  body: any,
  user: any
) {
  try {
    const { id } = body

    if (!id) {
      return res.status(400).json({
        error: 'ID is required for deletion',
        code: 'MISSING_ID',
      } as ErrorResponse)
    }

    let deleted

    if (config.enableSoftDelete) {
      // Soft delete
      deleted = await delegate.update({
        where: { id },
        data: { deleted_at: new Date() },
      })
    } else {
      // Hard delete
      deleted = await delegate.delete({
        where: { id },
      })
    }

    // Audit logging
    if (config.auditLog) {
      await logAuditAction(
        config.prisma,
        'DELETE',
        config.model,
        id,
        user?.id,
        { softDelete: config.enableSoftDelete }
      )
    }

    return res.status(200).json({
      data: deleted,
      message: 'Record deleted successfully',
    } as SuccessResponse<any>)
  } catch (error) {
    throw error
  }
}
