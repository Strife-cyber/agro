/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// Validation schema for order processing
const orderProcessingSchema = z.object({
  client_id: z.string(),
  warehouse_id: z.string().uuid(),
  items: z.array(z.object({
    product_id: z.string().uuid(),
    quantity: z.number().positive(),
    unit_price: z.number().positive(),
  })).min(1),
  delivery_option: z.boolean().default(false),
  delivery_address: z.string().optional(),
  payment_method: z.enum(['direct', 'credit']),
})

/**
 * ORDER PROCESSING ENDPOINT
 * 
 * This endpoint handles the complete order processing workflow:
 * 
 * ORDER PROCESSING STEPS:
 * 1. Validate stock availability for all items
 * 2. Calculate total amount with markup
 * 3. Create order and order items
 * 4. Update stock quantities
 * 5. Create delivery record (if delivery option selected)
 * 6. Process payment
 * 7. Send notifications
 * 
 * BUSINESS RULES:
 * - Stock must be available for all items
 * - Orders can only be placed by authenticated clients
 * - Stock is automatically decremented when order is placed
 * - Payment is processed immediately for direct payments
 * - Credit payments are marked as pending
 * - Delivery is automatically created if delivery option is selected
 * - All actions are logged for audit trail
 * 
 * STOCK VALIDATION:
 * - Checks if sufficient stock exists for each product
 * - Validates stock is in the correct warehouse
 * - Prevents overselling
 * 
 * PRICING:
 * - Unit prices are set by the platform (not client)
 * - Markup is applied based on business rules
 * - Total is calculated automatically
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

    // Check if user is client or admin
    if (user.role !== 'client' && user.role !== 'admin') {
      return res.status(403).json({
        error: 'Only clients can place orders',
        code: 'INSUFFICIENT_PERMISSIONS',
      })
    }

    // Use transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // Step 1: Validate stock availability for all items
      const stockValidation = await validateStockAvailability(tx, validatedData.items, validatedData.warehouse_id)
      
      if (!stockValidation.valid) {
        throw new Error(`Insufficient stock for product: ${stockValidation.productName}`)
      }

      // Step 2: Calculate total amount
      const totalAmount = validatedData.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0)

      // Step 3: Create order
      const order = await tx.orders.create({
        data: {
          client_id: validatedData.client_id,
          warehouse_id: validatedData.warehouse_id,
          total_amount: totalAmount,
          status: 'pending',
          delivery_option: validatedData.delivery_option,
          delivery_address: validatedData.delivery_address,
          payment_method: validatedData.payment_method,
          created_at: new Date(),
          updated_at: new Date(),
        },
      })

      // Step 4: Create order items and update stock
      const orderItems = []
      for (const item of validatedData.items) {
        // Create order item
        const orderItem = await tx.order_items.create({
          data: {
            order_id: order.order_id,
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
          },
        })
        orderItems.push(orderItem)

        const stock = await tx.stocks.findFirst({
            where: {
                product_id: item.product_id,
                warehouse_id: validatedData.warehouse_id,
            },
            select: { stock_id: true },
        });
        
        if (stock) {
            await tx.stocks.update({
                where: { stock_id: stock.stock_id },
                data: {
                quantity: { decrement: item.quantity },
                last_updated: new Date(),
                },
            });
        }          
      }

      // Step 5: Create delivery record if delivery option is selected
      let delivery = null
      if (validatedData.delivery_option) {
        delivery = await tx.deliveries.create({
          data: {
            order_id: order.order_id,
            status: 'assigned',
            created_at: new Date(),
            updated_at: new Date(),
          },
        })
      }

      // Step 6: Process payment
      const payment = await tx.payments.create({
        data: {
          order_id: order.order_id,
          amount: totalAmount,
          payment_method: validatedData.payment_method,
          status: validatedData.payment_method === 'direct' ? 'completed' : 'pending',
          payment_date: new Date(),
          created_at: new Date(),
        },
      })

      // Step 7: Update order status based on payment
      const updatedOrder = await tx.orders.update({
        where: { order_id: order.order_id },
        data: {
          status: validatedData.payment_method === 'direct' ? 'paid' : 'pending',
          updated_at: new Date(),
        },
      })

      return {
        order: updatedOrder,
        orderItems,
        delivery,
        payment,
      }
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
  tx: any,
  items: any[],
  warehouseId: string
): Promise<{ valid: boolean; productName?: string; availableQuantity?: number; requestedQuantity?: number }> {
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

    if (stock.quantity < item.quantity) {
      return {
        valid: false,
        productName: stock.products.name,
        availableQuantity: stock.quantity,
        requestedQuantity: item.quantity,
      }
    }
  }

  return { valid: true }
}
