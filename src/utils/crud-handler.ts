// src/utils/crudHandler.ts
import { NextApiRequest, NextApiResponse } from 'next'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'

// Type definitions
type ModelKeys = Extract<keyof PrismaClient, string>

interface User {
  id: string
  email: string
  name: string
  role: string | null
}

interface RecordWithId {
  id?: string
  [key: string]: unknown
}

interface ErrorResponse {
  error: string
  code: string
  details?: object
}

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

// Helper function to get record ID safely
function getRecordId(record: RecordWithId, modelName: string): string {
  if (record.id) {
    return record.id
  }
  
  const idField = `${modelName.slice(0, -1)}_id`
  const idValue = record[idField]
  
  if (typeof idValue === 'string') {
    return idValue
  }
  
  throw new Error(`Could not determine ID for record from model ${modelName}`)
}

// Validation schemas
const baseValidationSchemas = {
  pagination: z.object({
    page: z.number().min(1).default(1),
    limit: z.number().min(1).max(100).default(10),
  }),
}

// Rate limiting
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

function checkRateLimit(ip: string, limit: number = 100, windowMs: number = 15 * 60 * 1000): boolean {
  const now = Date.now()
  const record = rateLimitMap.get(ip)

  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs })
    return true
  }

  if (record.count >= limit) {
    return false
  }

  record.count++
  return true
}

// Input sanitization
function sanitizeInput(input: object | string): object | string {
  if (typeof input === 'string') {
    return input.trim().replace(/[<>]/g, '')
  }

  if (typeof input === 'object' && input !== null) {
    const sanitized: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(input)) {
      if (typeof value === 'string') {
        sanitized[key] = value.trim().replace(/[<>]/g, '')
      } else {
        sanitized[key] = value
      }
    }
    return sanitized
  }

  return input
}

// Authorization check
async function checkAuthorization(
  req: NextApiRequest,
  allowedRoles?: string[]
): Promise<{ authorized: boolean; user?: User; error?: string }> {
  try {
    // Get user data from middleware headers
    const userId = req.headers['x-user-id'] as string // Assuming middleware sets this

    if (!userId) {
      return { authorized: false, error: 'Authentication required: User ID missing from headers' }
    }

    // Import prisma instance dynamically to avoid circular dependencies
    const { prisma } = await import('@/lib/prisma')

    // Fetch user data from database using user ID
    const dbUser = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        created_at: true,
        updated_at: true,
      },
    })

    if (!dbUser) {
      return { authorized: false, error: 'User not found in database' }
    }

    // Check role-based access control
    if (allowedRoles && allowedRoles.length > 0) {
      const userRole = dbUser.role || 'client'
      if (!allowedRoles.includes(userRole)) {
        return { authorized: false, error: 'Insufficient permissions' }
      }
    }

    return { authorized: true, user: dbUser }
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
  details?: object
) {
  try {
    await prisma.transaction_logs.create({
      data: {
        entity_type: entityType as 'approvisionnements' | 'stocks' | 'orders' | 'deliveries' | 'payments' | 'user_roles',
        entity_id: entityId,
        action: action as 'create' | 'insert' | 'update' | 'delete' | 'CREATE' | 'INSERT' | 'UPDATE' | 'DELETE',
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
      const sanitizedBody = sanitizeInput(req.body) as Record<string, unknown>
      const sanitizedQuery = sanitizeInput(req.query) as Record<string, unknown>

      const delegate = config.prisma[config.model]

      switch (req.method) {
        case 'GET':
          return await handleGet(req, res, delegate, config, sanitizedQuery)

        case 'POST':
          return await handlePost(req, res, delegate, config, sanitizedBody, authResult.user!)

        case 'PUT':
          return await handlePut(req, res, delegate, config, sanitizedBody, authResult.user!)

        case 'DELETE':
          return await handleDelete(req, res, delegate, config, sanitizedBody, authResult.user!)

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
  delegate: PrismaClient[ModelKeys],
  config: CrudHandlerConfig,
  query: Record<string, unknown>
) {
  try {
    const { id } = query

    // Single record by ID
    if (id) {
      const record = await delegate.findUnique({
        where: { id: id as string },
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
      } as SuccessResponse<object>)
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
      } as SuccessResponse<object>)
    }

    // Simple findMany without pagination
    const records = await delegate.findMany({
      orderBy: { created_at: 'desc' },
    })

    return res.status(200).json({
      data: records,
      message: 'Records retrieved successfully',
    } as SuccessResponse<object>)
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
  delegate: PrismaClient[ModelKeys],
  config: CrudHandlerConfig,
  body: Record<string, unknown>,
  user: User
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

    // Create record
    const record = await delegate.create({
      data: dataWithAudit,
    })

    // Audit logging
    if (config.auditLog) {
      await logAuditAction(
        config.prisma,
        'CREATE',
        config.model,
        getRecordId(record as RecordWithId, config.model),
        user.id,
        { action: 'create', data: validatedData }
      )
    }

    return res.status(201).json({
      data: record,
      message: 'Record created successfully',
    } as SuccessResponse<object>)
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
  delegate: PrismaClient[ModelKeys],
  config: CrudHandlerConfig,
  body: Record<string, unknown>,
  user: User
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
      validatedData = config.validationSchema.parse(updateData)
    }

    // Add audit fields
    const dataWithAudit = {
      ...validatedData,
      updated_at: new Date(),
    }

    // Update record
    const record = await delegate.update({
      where: { id: id as string },
      data: dataWithAudit,
    })

    // Audit logging
    if (config.auditLog) {
      await logAuditAction(
        config.prisma,
        'UPDATE',
        config.model,
        getRecordId(record as RecordWithId, config.model),
        user.id,
        { action: 'update', data: validatedData }
      )
    }

    return res.status(200).json({
      data: record,
      message: 'Record updated successfully',
    } as SuccessResponse<object>)
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
  delegate: PrismaClient[ModelKeys],
  config: CrudHandlerConfig,
  body: Record<string, unknown>,
  user: User
) {
  try {
    const { id } = body

    if (!id) {
      return res.status(400).json({
        error: 'ID is required for deletion',
        code: 'MISSING_ID',
      } as ErrorResponse)
    }

    let record: object

    if (config.enableSoftDelete) {
      // Soft delete - update deleted_at field
      record = await delegate.update({
        where: { id: id as string },
        data: {
          deleted_at: new Date(),
          updated_at: new Date(),
        },
      })
    } else {
      // Hard delete
      record = await delegate.delete({
        where: { id: id as string },
      })
    }

    // Audit logging
    if (config.auditLog) {
      await logAuditAction(
        config.prisma,
        'DELETE',
        config.model,
        getRecordId(record as RecordWithId, config.model),
        user.id,
        { action: 'delete', soft_delete: config.enableSoftDelete }
      )
    }

    return res.status(200).json({
      data: record,
      message: config.enableSoftDelete ? 'Record soft deleted successfully' : 'Record deleted successfully',
    } as SuccessResponse<object>)
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
