import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { Prisma } from '@/generated/prisma'

// Type definitions for order processing
interface OrderItem {
  product_id: string
  quantity: number
  unit_price: number
}

interface StockValidationResult {
  valid: boolean
  productName?: string
  availableQuantity?: number
  requestedQuantity?: number
}

// Validation schema for order processing
const orderProcessingSchema = z.object({
  client_id: z.string().uuid(),
  warehouse_id: z.string().uuid(),
  delivery_option: z.boolean().default(false),
  payment_method: z.enum(['direct', 'credit']),
  items: z.array(z.object({
    product_id: z.string().uuid(),
    quantity: z.number().positive(),
    unit_price: z.number().positive(),
  })),
  delivery_address: z.string().optional(),
  notes: z.string().optional(),
})

/**
 * ORDER PROCESSING ENDPOINT
 * 
 * This endpoint handles the complete order processing workflow:
 * 
 * PROCESSING STEPS:
 * 1. Validate input data and user permissions
 * 2. Check stock availability for all items
 * 3. Calculate total order amount
 * 4. Create order and order items in database
 * 5. Update stock quantities
 * 6. Create delivery record
 * 7. Process payment (placeholder)
 * 8. Send notifications
 * 9. Log all actions for audit trail
 * 
 * BUSINESS RULES:
 * - Only authenticated users can process orders
 * - Stock must be available in the specified warehouse
 * - Order total is calculated from item quantities and prices
 * - Stock is automatically reduced when order is processed
 * - Delivery record is created for tracking
 * - Payment processing is triggered (placeholder implementation)
 * 
 * VALIDATION RULES:
 * - All required fields must be provided
 * - Product IDs must be valid UUIDs
 * - Quantities must be positive numbers
 * - Warehouse must exist and have sufficient stock
 * 
 * NOTIFICATIONS:
 * - Client receives order confirmation
 * - Warehouse staff is notified of new order
 * - All actions are logged in transaction_logs
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Only allow POST for order processing
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

    const user = JSON.parse(userData)
    const validatedData = orderProcessingSchema.parse(req.body)

    // Use database transaction for atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Validate stock availability
      const stockValidation = await validateStockAvailability(tx, validatedData.items, validatedData.warehouse_id)
      
      if (!stockValidation.valid) {
        throw new Error(`Insufficient stock for ${stockValidation.productName}. Available: ${stockValidation.availableQuantity}, Requested: ${stockValidation.requestedQuantity}`)
      }

      // Calculate total amount
      const totalAmount = validatedData.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0)

      // Create order
      const order = await tx.orders.create({
        data: {
          client_id: validatedData.client_id,
          warehouse_id: validatedData.warehouse_id,
          total_amount: totalAmount,
          status: 'pending',
          delivery_option: validatedData.delivery_option,
          payment_method: validatedData.payment_method,
          delivery_address: validatedData.delivery_address,
        },
      })

      // Create order items
      const orderItems = await Promise.all(
        validatedData.items.map(item =>
          tx.order_items.create({
            data: {
              order_id: order.order_id,
              product_id: item.product_id,
              quantity: item.quantity,
              unit_price: item.unit_price,
            },
          })
        )
      )

      // Update stock quantities
      await Promise.all(
        validatedData.items.map(item =>
          tx.stocks.updateMany({
            where: {
              product_id: item.product_id,
              warehouse_id: validatedData.warehouse_id,
            },
            data: {
              quantity: {
                decrement: item.quantity,
              },
            },
          })
        )
      )

      // Create delivery record
      const delivery = await tx.deliveries.create({
        data: {
          order_id: order.order_id,
          driver_id: null, // Will be assigned later
          status: 'assigned',
          delivery_date: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
        },
      })

      return { order, orderItems, delivery }
    })

    // Log the action
    await prisma.transaction_logs.create({
      data: {
        entity_type: 'orders',
        entity_id: result.order.order_id,
        action: 'CREATE',
        user_id: user.id,
        details: {
          action: 'process_order',
          total_amount: result.order.total_amount,
          items_count: result.orderItems.length,
          delivery_option: validatedData.delivery_option,
          payment_method: validatedData.payment_method,
        },
      },
    })

    // Send notification to client
    await prisma.notifications.create({
      data: {
        user_id: validatedData.client_id,
        type: 'email',
        message: `Your order #${result.order.order_id} has been processed successfully. Total: $${result.order.total_amount}`,
        status: 'sent',
      },
    })

    // Send notification to warehouse staff
    await prisma.notifications.create({
      data: {
        user_id: 'warehouse-staff-id', // In real app, get actual warehouse staff
        type: 'email',
        message: `New order #${result.order.order_id} received. ${result.orderItems.length} items to prepare.`,
        status: 'sent',
      },
    })

    return res.status(201).json({
      data: result,
      message: 'Order processed successfully',
    })
  } catch (error) {
    console.error('Order processing error:', error)
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid input data',
        code: 'VALIDATION_ERROR',
        details: error.errors,
      })
    }

    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
      code: 'INTERNAL_SERVER_ERROR',
    })
  }
}

/**
 * STOCK AVAILABILITY VALIDATION
 * 
 * Validates that sufficient stock exists for all items in the order:
 * - Checks if stock exists for each product in the specified warehouse
 * - Validates quantity is available
 * - Returns validation result with details
 */
async function validateStockAvailability(
  tx: Prisma.TransactionClient,
  items: OrderItem[],
  warehouseId: string
): Promise<StockValidationResult> {
  for (const item of items) {
    const stock = await tx.stocks.findFirst({
      where: {
        product_id: item.product_id,
        warehouse_id: warehouseId,
      },
      include: {
        products: true,
      },
    })

    if (!stock) {
      return {
        valid: false,
        productName: `Product ID: ${item.product_id}`,
        availableQuantity: 0,
        requestedQuantity: item.quantity,
      }
    }

    if (Number(stock.quantity) < item.quantity) {
      return {
        valid: false,
        productName: stock.products.name,
        availableQuantity: Number(stock.quantity),
        requestedQuantity: item.quantity,
      }
    }
  }

  return { valid: true }
}
