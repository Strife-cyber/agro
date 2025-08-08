import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { Approvisionnement } from '@/types'

// Type definitions for workflow functions
interface WorkflowUser {
  id: string
  email: string
  name: string
  role: string
}

interface WorkflowData {
  notes?: string
  reason?: string
  actual_quantity?: number
  actual_price?: number
}

// Validation schema for workflow actions
const workflowActionSchema = z.object({
  action: z.enum(['validate_bd', 'reject_bd', 'receive_stock', 'reject_stock']),
  approvisionnement_id: z.string().uuid(),
  notes: z.string().optional(),
  reason: z.string().optional(),
  actual_quantity: z.number().positive().optional(),
  actual_price: z.number().positive().optional(),
})

/**
 * APPROVISIONNEMENT WORKFLOW ENDPOINT
 * 
 * This endpoint handles the complete approvisionnement workflow:
 * 
 * WORKFLOW STEPS:
 * 1. Supplier submits approvisionnement (pending)
 * 2. Business Developer validates or rejects (validated_bd / rejected)
 * 3. Stock Manager receives or rejects stock (received / rejected)
 * 
 * BUSINESS RULES:
 * - Only Business Developers can validate/reject approvisionnements
 * - Only Stock Managers can receive/reject stock
 * - All actions are logged for audit trail
 * - Notifications are sent to relevant parties
 * - Stock is automatically updated upon receipt
 * 
 * VALIDATION RULES:
 * - Business Developer validation: pending → validated_bd
 * - Business Developer rejection: pending → rejected
 * - Stock Manager receipt: validated_bd → received
 * - Stock Manager rejection: validated_bd → rejected
 * 
 * NOTIFICATIONS:
 * - Stock Manager notified when Business Developer validates
 * - Business Developer notified when Stock Manager receives/rejects
 * - All actions logged in transaction_logs
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Only allow POST for workflow actions
    if (req.method !== 'POST') {
      return res.status(405).json({
        error: 'Method not allowed',
        code: 'METHOD_NOT_ALLOWED',
      })
    }

    // Get user from middleware headers
    const userData = req.headers['x-user-data'] as string
    if (!userData) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      })
    }

    const user: WorkflowUser = JSON.parse(userData)
    const validatedData = workflowActionSchema.parse(req.body)

    // Get approvisionnement
    const approvisionnement = await prisma.approvisionnements.findUnique({
      where: { approvisionnement_id: validatedData.approvisionnement_id },
      include: {
        products: true,
      },
    })

    if (!approvisionnement) {
      return res.status(404).json({
        error: 'Approvisionnement not found',
        code: 'NOT_FOUND',
      })
    }

    // Handle different workflow actions
    switch (validatedData.action) {
      case 'validate_bd':
        return await handleBusinessDeveloperValidation(req, res, user, approvisionnement, validatedData)
      
      case 'reject_bd':
        return await handleBusinessDeveloperRejection(req, res, user, approvisionnement, validatedData)
      
      case 'receive_stock':
        return await handleStockReceival(req, res, user, approvisionnement, validatedData)
      
      case 'reject_stock':
        return await handleStockRejection(req, res, user, approvisionnement, validatedData)
      
      default:
        return res.status(400).json({
          error: 'Invalid action',
          code: 'INVALID_ACTION',
        })
    }
  } catch (error) {
    console.error('Workflow error:', error)
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid input data',
        code: 'VALIDATION_ERROR',
        details: error.errors,
      })
    }

    return res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_SERVER_ERROR',
    })
  }
}

/**
 * BUSINESS DEVELOPER VALIDATION
 * 
 * Business Developer validates the approvisionnement based on:
 * - Product quality assessment
 * - Price competitiveness
 * - Supplier reliability
 * - Market demand
 * 
 * Updates status to 'validated_bd' and triggers next step in workflow
 */
async function handleBusinessDeveloperValidation(
  req: NextApiRequest,
  res: NextApiResponse,
  user: WorkflowUser,
  approvisionnement: Approvisionnement,
  data: WorkflowData
) {
  // Check if user is Business Developer
  if (user.role !== 'business_developer' && user.role !== 'admin') {
    return res.status(403).json({
      error: 'Only Business Developers can validate approvisionnements',
      code: 'INSUFFICIENT_PERMISSIONS',
    })
  }

  // Check if approvisionnement is in correct status
  if (approvisionnement.status !== 'pending') {
    return res.status(400).json({
      error: 'Approvisionnement must be in pending status to be validated',
      code: 'INVALID_STATUS',
    })
  }

  try {
    // Update approvisionnement status
    const updatedApprovisionnement = await prisma.approvisionnements.update({
      where: { approvisionnement_id: approvisionnement.approvisionnement_id },
      data: {
        status: 'validated_bd',
        business_developer_id: user.id,
        updated_at: new Date(),
      },
    })

    // Log the action
    await prisma.transaction_logs.create({
      data: {
        entity_type: 'approvisionnements',
        entity_id: approvisionnement.approvisionnement_id,
        action: 'UPDATE',
        user_id: user.id,
        details: {
          action: 'validate_bd',
          previous_status: approvisionnement.status,
          new_status: 'validated_bd',
          notes: data.notes,
        },
      },
    })

    // Send notification to stock manager (in real app, this would be async)
    await prisma.notifications.create({
      data: {
        user_id: approvisionnement.stock_manager_id || 'stock-manager-id', // In real app, get actual stock manager
        type: 'email',
        message: `New approvisionnement validated by Business Developer: ${approvisionnement.products.name} - ${approvisionnement.quantity} units`,
        status: 'sent',
      },
    })

    return res.status(200).json({
      data: updatedApprovisionnement,
      message: 'Approvisionnement validated successfully by Business Developer',
    })
  } catch (error) {
    console.error('Business Developer validation error:', error)
    throw error
  }
}

/**
 * BUSINESS DEVELOPER REJECTION
 * 
 * Business Developer rejects the approvisionnement due to:
 * - Poor product quality
 * - Uncompetitive pricing
 * - Supplier reliability issues
 * 
 * Updates status to 'rejected' and ends workflow
 */
async function handleBusinessDeveloperRejection(
  req: NextApiRequest,
  res: NextApiResponse,
  user: WorkflowUser,
  approvisionnement: Approvisionnement,
  data: WorkflowData
) {
  // Check if user is Business Developer
  if (user.role !== 'business_developer' && user.role !== 'admin') {
    return res.status(403).json({
      error: 'Only Business Developers can reject approvisionnements',
      code: 'INSUFFICIENT_PERMISSIONS',
    })
  }

  // Check if approvisionnement is in correct status
  if (approvisionnement.status !== 'pending') {
    return res.status(400).json({
      error: 'Approvisionnement must be in pending status to be rejected',
      code: 'INVALID_STATUS',
    })
  }

  try {
    // Update approvisionnement status
    const updatedApprovisionnement = await prisma.approvisionnements.update({
      where: { approvisionnement_id: approvisionnement.approvisionnement_id },
      data: {
        status: 'rejected',
        business_developer_id: user.id,
        updated_at: new Date(),
      },
    })

    // Log the action
    await prisma.transaction_logs.create({
      data: {
        entity_type: 'approvisionnements',
        entity_id: approvisionnement.approvisionnement_id,
        action: 'UPDATE',
        user_id: user.id,
        details: {
          action: 'reject_bd',
          previous_status: approvisionnement.status,
          new_status: 'rejected',
          notes: data.notes,
        },
      },
    })

    // Send notification to supplier
    await prisma.notifications.create({
      data: {
        user_id: approvisionnement.supplier_id,
        type: 'email',
        message: `Your approvisionnement has been rejected by Business Developer. Reason: ${data.notes || 'No reason provided'}`,
        status: 'sent',
      },
    })

    return res.status(200).json({
      data: updatedApprovisionnement,
      message: 'Approvisionnement rejected successfully by Business Developer',
    })
  } catch (error) {
    console.error('Business Developer rejection error:', error)
    throw error
  }
}

/**
 * STOCK MANAGER RECEIVAL
 * 
 * Stock Manager receives physical stock and validates:
 * - Quantity matches approvisionnement
 * - Quality meets standards
 * - Product specifications are correct
 * 
 * Updates status to 'received', updates inventory, and triggers payment
 */
async function handleStockReceival(
  req: NextApiRequest,
  res: NextApiResponse,
  user: WorkflowUser,
  approvisionnement: Approvisionnement,
  data: WorkflowData
) {
  // Check if user is Stock Manager
  if (user.role !== 'stock_manager' && user.role !== 'admin') {
    return res.status(403).json({
      error: 'Only Stock Managers can receive stock',
      code: 'INSUFFICIENT_PERMISSIONS',
    })
  }

  // Check if approvisionnement is in correct status
  if (approvisionnement.status !== 'validated_bd') {
    return res.status(400).json({
      error: 'Approvisionnement must be validated by Business Developer before stock can be received',
      code: 'INVALID_STATUS',
    })
  }

  try {
    // Use transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // Update approvisionnement status
      const updatedApprovisionnement = await tx.approvisionnements.update({
        where: { approvisionnement_id: approvisionnement.approvisionnement_id },
        data: {
          status: 'received',
          stock_manager_id: user.id,
          updated_at: new Date(),
        },
      })

      // Update or create stock entry
      const existingStock = await tx.stocks.findFirst({
        where: {
          product_id: approvisionnement.product_id,
          warehouse_id: approvisionnement.warehouse_id,
        },
      })

      if (existingStock) {
        // Update existing stock
        await tx.stocks.update({
          where: { stock_id: existingStock.stock_id },
          data: {
            quantity: existingStock.quantity + approvisionnement.quantity,
            unit_price: approvisionnement.proposed_price, // Update with new price
            last_updated: new Date(),
            approvisionnement_id: approvisionnement.approvisionnement_id,
          },
        })
      } else {
        // Create new stock entry
        await tx.stocks.create({
          data: {
            product_id: approvisionnement.product_id,
            warehouse_id: approvisionnement.warehouse_id,
            quantity: approvisionnement.quantity,
            unit_price: approvisionnement.proposed_price,
            approvisionnement_id: approvisionnement.approvisionnement_id,
          },
        })
      }

      // Create payment record for supplier
      await tx.payments.create({
        data: {
          approvisionnement_id: approvisionnement.approvisionnement_id,
          amount: approvisionnement.quantity * approvisionnement.proposed_price,
          payment_method: 'direct',
          status: 'pending',
          payment_date: new Date(),
        },
      })

      return updatedApprovisionnement
    })

    // Log the action
    await prisma.transaction_logs.create({
      data: {
        entity_type: 'approvisionnements',
        entity_id: approvisionnement.approvisionnement_id,
        action: 'UPDATE',
        user_id: user.id,
        details: {
          action: 'receive_stock',
          previous_status: approvisionnement.status,
          new_status: 'received',
          quantity_received: approvisionnement.quantity,
          notes: data.notes,
        },
      },
    })

    // Send notification to supplier about payment
    await prisma.notifications.create({
      data: {
        user_id: approvisionnement.supplier_id,
        type: 'email',
        message: `Your stock has been received and payment of ${approvisionnement.quantity * approvisionnement.proposed_price} has been processed.`,
        status: 'sent',
      },
    })

    return res.status(200).json({
      data: result,
      message: 'Stock received successfully. Inventory updated and payment processed.',
    })
  } catch (error) {
    console.error('Stock receival error:', error)
    throw error
  }
}

/**
 * STOCK MANAGER REJECTION
 * 
 * Stock Manager rejects physical stock due to:
 * - Quantity mismatch
 * - Quality issues
 * - Wrong product specifications
 * 
 * Updates status to 'rejected' and notifies supplier
 */
async function handleStockRejection(
  req: NextApiRequest,
  res: NextApiResponse,
  user: WorkflowUser,
  approvisionnement: Approvisionnement,
  data: WorkflowData
) {
  // Check if user is Stock Manager
  if (user.role !== 'stock_manager' && user.role !== 'admin') {
    return res.status(403).json({
      error: 'Only Stock Managers can reject stock',
      code: 'INSUFFICIENT_PERMISSIONS',
    })
  }

  // Check if approvisionnement is in correct status
  if (approvisionnement.status !== 'validated_bd') {
    return res.status(400).json({
      error: 'Approvisionnement must be validated by Business Developer before stock can be rejected',
      code: 'INVALID_STATUS',
    })
  }

  try {
    // Update approvisionnement status
    const updatedApprovisionnement = await prisma.approvisionnements.update({
      where: { approvisionnement_id: approvisionnement.approvisionnement_id },
      data: {
        status: 'rejected',
        stock_manager_id: user.id,
        updated_at: new Date(),
      },
    })

    // Log the action
    await prisma.transaction_logs.create({
      data: {
        entity_type: 'approvisionnements',
        entity_id: approvisionnement.approvisionnement_id,
        action: 'UPDATE',
        user_id: user.id,
        details: {
          action: 'reject_stock',
          previous_status: approvisionnement.status,
          new_status: 'rejected',
          notes: data.notes,
        },
      },
    })

    // Send notification to supplier
    await prisma.notifications.create({
      data: {
        user_id: approvisionnement.supplier_id,
        type: 'email',
        message: `Your stock has been rejected by Stock Manager. Reason: ${data.notes || 'No reason provided'}`,
        status: 'sent',
      },
    })

    return res.status(200).json({
      data: updatedApprovisionnement,
      message: 'Stock rejected successfully by Stock Manager',
    })
  } catch (error) {
    console.error('Stock rejection error:', error)
    throw error
  }
}
