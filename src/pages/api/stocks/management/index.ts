import { z } from 'zod'
import { Stock, Warehouse } from '@/types'
import { prisma } from '@/lib/prisma'
import { NextApiRequest, NextApiResponse } from 'next'

// Type definitions for stock management
interface User {
  id: string
  email: string
  name: string
  role: string
}

interface StockData {
  product_id: string
  warehouse_id: string
  quantity: number
  unit_price?: number
  reason?: string
}

interface StockAlertData {
  product_id: string
  threshold: number
}

// Validation schemas
const stockAdjustmentSchema = z.object({
  action: z.enum(['add', 'remove']),
  product_id: z.string().uuid(),
  warehouse_id: z.string().uuid(),
  quantity: z.number().positive(),
  unit_price: z.number().positive().optional(),
  reason: z.string().optional(),
})

const stockTransferSchema = z.object({
  product_id: z.string().uuid(),
  from_warehouse_id: z.string().uuid(),
  to_warehouse_id: z.string().uuid(),
  quantity: z.number().positive(),
  reason: z.string().optional(),
})

const stockAlertSchema = z.object({
  product_id: z.string().uuid(),
  threshold: z.number().positive(),
})

/**
 * STOCK MANAGEMENT ENDPOINT
 * 
 * This endpoint handles comprehensive stock management operations:
 * 
 * OPERATIONS:
 * 1. Stock Adjustments (add/remove stock)
 * 2. Stock Transfers (between warehouses)
 * 3. Inventory Reports (comprehensive reporting)
 * 4. Stock Alerts (low stock notifications)
 * 
 * BUSINESS RULES:
 * - Only Stock Managers and Admins can perform stock operations
 * - All operations are logged for audit trail
 * - Stock transfers require sufficient quantity in source warehouse
 * - Low stock alerts are automatically triggered
 * - Inventory reports include warehouse breakdowns
 * 
 * VALIDATION RULES:
 * - All required fields must be provided
 * - Quantities must be positive numbers
 * - Warehouse IDs must be valid UUIDs
 * - Product IDs must be valid UUIDs
 * 
 * AUDIT TRAIL:
 * - All stock movements are logged
 * - User actions are tracked
 * - Detailed change history maintained
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Only allow POST for stock management
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

    const user: User = JSON.parse(userData)
    const { action, ...data } = req.body

    // Check user permissions
    if (user.role !== 'stock_manager' && user.role !== 'admin') {
      return res.status(403).json({
        error: 'Only Stock Managers and Admins can perform stock operations',
        code: 'INSUFFICIENT_PERMISSIONS',
      })
    }

    // Handle different stock management actions
    switch (action) {
      case 'adjust':
        return await handleStockAdjustment(req, res, user, data)
      
      case 'transfer':
        return await handleStockTransfer(req, res, user, data)
      
      case 'report':
        return await handleInventoryReport(req, res, user)
      
      case 'alert':
        return await handleStockAlert(req, res, user, data)
      
      default:
        return res.status(400).json({
          error: 'Invalid action',
          code: 'INVALID_ACTION',
        })
    }
  } catch (error) {
    console.error('Stock management error:', error)
    
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
 * STOCK ADJUSTMENT
 * 
 * Adds or removes stock from a warehouse:
 * - Validates stock exists in the warehouse
 * - Updates quantity based on action (add/remove)
 * - Logs the adjustment for audit trail
 * - Sends notifications for significant changes
 */
async function handleStockAdjustment(
  req: NextApiRequest,
  res: NextApiResponse,
  user: User,
  data: StockData
) {
  const validatedData = stockAdjustmentSchema.parse({ ...req.body, ...data })

  try {
    // Use database transaction for atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Get current stock
      const currentStock = await tx.stocks.findFirst({
        where: {
          product_id: validatedData.product_id,
          warehouse_id: validatedData.warehouse_id,
        },
        include: {
          products: true,
          warehouses: true,
        },
      })

      if (!currentStock) {
        throw new Error('Stock not found for this product and warehouse')
      }

      // Calculate new quantity
      const newQuantity = validatedData.action === 'add' 
        ? Number(currentStock.quantity) + validatedData.quantity
        : Number(currentStock.quantity) - validatedData.quantity

      if (newQuantity < 0) {
        throw new Error('Insufficient stock to remove')
      }

      // Update stock
      const updatedStock = await tx.stocks.update({
        where: { stock_id: currentStock.stock_id },
        data: {
          quantity: newQuantity,
          unit_price: validatedData.unit_price || currentStock.unit_price,
          last_updated: new Date(),
        },
        include: {
          products: true,
          warehouses: true,
        },
      })

      // Log the adjustment
      await tx.transaction_logs.create({
        data: {
          entity_type: 'stocks',
          entity_id: currentStock.stock_id,
          action: 'UPDATE',
          user_id: user.id,
          details: {
            action: 'stock_adjustment',
            adjustment_type: validatedData.action,
            quantity_change: validatedData.quantity,
            previous_quantity: currentStock.quantity,
            new_quantity: newQuantity,
            reason: validatedData.reason,
          },
        },
      })

      return updatedStock
    })

    // Send notification for significant changes
    if (validatedData.quantity > 100) {
      await prisma.notifications.create({
        data: {
          user_id: user.id,
          type: 'email',
          message: `Large stock adjustment: ${validatedData.action} ${validatedData.quantity} units of ${result.products.name} in ${result.warehouses.name}`,
          status: 'sent',
        },
      })
    }

    return res.status(200).json({
      data: result,
      message: `Stock ${validatedData.action}ed successfully`,
    })
  } catch (error) {
    console.error('Stock adjustment error:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to adjust stock',
      code: 'ADJUSTMENT_FAILED',
    })
  }
}

/**
 * STOCK TRANSFER
 * 
 * Transfers stock between warehouses:
 * - Validates sufficient stock in source warehouse
 * - Reduces stock in source warehouse
 * - Increases stock in destination warehouse
 * - Logs the transfer for audit trail
 * - Sends notifications to relevant staff
 */
async function handleStockTransfer(
  req: NextApiRequest,
  res: NextApiResponse,
  user: User,
  data: StockData
) {
  const validatedData = stockTransferSchema.parse({ ...req.body, ...data })

  try {
    // Use database transaction for atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Get source stock
      const sourceStock = await tx.stocks.findFirst({
        where: {
          product_id: validatedData.product_id,
          warehouse_id: validatedData.from_warehouse_id,
        },
        include: {
          products: true,
          warehouses: true,
        },
      })

      if (!sourceStock) {
        throw new Error('Source stock not found')
      }

      if (Number(sourceStock.quantity) < validatedData.quantity) {
        throw new Error('Insufficient stock in source warehouse')
      }

      // Get or create destination stock
      let destinationStock = await tx.stocks.findFirst({
        where: {
          product_id: validatedData.product_id,
          warehouse_id: validatedData.to_warehouse_id,
        },
        include: {
          products: true,
          warehouses: true,
        },
      })

      if (!destinationStock) {
        // Create new stock record for destination
        destinationStock = await tx.stocks.create({
          data: {
            product_id: validatedData.product_id,
            warehouse_id: validatedData.to_warehouse_id,
            quantity: validatedData.quantity,
            unit_price: sourceStock.unit_price,
          },
          include: {
            products: true,
            warehouses: true,
          },
        })
      } else {
        // Update existing destination stock
        destinationStock = await tx.stocks.update({
          where: { stock_id: destinationStock.stock_id },
          data: {
            quantity: Number(destinationStock.quantity) + validatedData.quantity,
            last_updated: new Date(),
          },
          include: {
            products: true,
            warehouses: true,
          },
        })
      }

      // Update source stock
      const updatedSourceStock = await tx.stocks.update({
        where: { stock_id: sourceStock.stock_id },
        data: {
          quantity: Number(sourceStock.quantity) - validatedData.quantity,
          last_updated: new Date(),
        },
        include: {
          products: true,
          warehouses: true,
        },
      })

      // Log the transfer
      await tx.transaction_logs.create({
        data: {
          entity_type: 'stocks',
          entity_id: sourceStock.stock_id,
          action: 'UPDATE',
          user_id: user.id,
          details: {
            action: 'stock_transfer',
            from_warehouse: sourceStock.warehouses.name,
            to_warehouse: destinationStock.warehouses.name,
            quantity_transferred: validatedData.quantity,
            reason: validatedData.reason,
          },
        },
      })

      return {
        source_stock: updatedSourceStock,
        destination_stock: destinationStock,
      }
    })

    // Send notification
    await prisma.notifications.create({
      data: {
        user_id: user.id,
        type: 'email',
        message: `Stock transfer completed: ${validatedData.quantity} units of ${result.destination_stock.products.name} from ${result.source_stock.warehouses.name} to ${result.destination_stock.warehouses.name}`,
        status: 'sent',
      },
    })

    return res.status(200).json({
      data: result,
      message: 'Stock transfer completed successfully',
    })
  } catch (error) {
    console.error('Stock transfer error:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to transfer stock',
      code: 'TRANSFER_FAILED',
    })
  }
}

/**
 * INVENTORY REPORT
 * 
 * Generates comprehensive inventory reports:
 * - Total stock value and items count
 * - Low stock items identification
 * - Warehouse breakdown
 * - Recent stock movements
 * - Stock value calculations
 */
async function handleInventoryReport(
  req: NextApiRequest,
  res: NextApiResponse,
  user: User
) {
  try {
    // Get all stock with related data
    const stockReport = await prisma.stocks.findMany({
      include: {
        products: true,
        warehouses: true,
      },
    })

    // Calculate totals
    const totalItems = stockReport.length
    const totalValue = stockReport.reduce((sum, stock) => 
      sum + (Number(stock.quantity) * Number(stock.unit_price)), 0
    )

    // Find low stock items (less than 10 units)
    const lowStockItems = stockReport.filter(stock => Number(stock.quantity) < 10)

    // Group by warehouse
    const warehouseReport = stockReport.reduce((acc: Record<string, { warehouse: Warehouse; items: Stock[]; total_value: number }>, stock) => {
      const warehouseName = stock.warehouses.name
      if (!acc[warehouseName]) {
        acc[warehouseName] = {
          warehouse: stock.warehouses,
          items: [],
          total_value: 0,
        }
      }
      acc[warehouseName].items.push(stock)
      acc[warehouseName].total_value += Number(stock.quantity) * Number(stock.unit_price)
      return acc
    }, {})

    // Get recent stock movements (last 30 days)
    const recentMovements = await prisma.transaction_logs.findMany({
      where: {
        entity_type: 'stocks',
        created_at: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        },
      },
      orderBy: { created_at: 'desc' },
      take: 50,
    })

    const report = {
      summary: {
        total_items: totalItems,
        total_value: totalValue,
        low_stock_items: lowStockItems.length,
        warehouses_count: Object.keys(warehouseReport).length,
      },
      low_stock_items: lowStockItems,
      warehouse_report: warehouseReport,
      recent_movements: recentMovements,
      generated_at: new Date(),
      generated_by: user.id,
    }

    return res.status(200).json({
      data: report,
      message: 'Inventory report generated successfully',
    })
  } catch (error) {
    console.error('Inventory report error:', error)
    return res.status(500).json({
      error: 'Failed to generate inventory report',
      code: 'REPORT_GENERATION_FAILED',
    })
  }
}

/**
 * STOCK ALERT
 * 
 * Sets up low stock alerts and notifications:
 * - Configures threshold for low stock alerts
 * - Sends notifications to relevant staff
 * - Tracks alert history
 */
async function handleStockAlert(
  req: NextApiRequest,
  res: NextApiResponse,
  user: User,
  data: StockAlertData
) {
  const validatedData = stockAlertSchema.parse(data)

  try {
    // Get current stock
    const currentStock = await prisma.stocks.findFirst({
      where: {
        product_id: validatedData.product_id,
      },
      include: {
        products: true,
      },
    })

    if (!currentStock) {
      return res.status(404).json({
        error: 'Stock not found for this product',
        code: 'STOCK_NOT_FOUND',
      })
    }

    // Check if stock is below threshold
    const isLowStock = Number(currentStock.quantity) <= validatedData.threshold

    if (isLowStock) {
      // Send notification to stock manager
      await prisma.notifications.create({
        data: {
          user_id: user.id,
          type: 'email',
          message: `LOW STOCK ALERT: ${currentStock.products.name} is below threshold. Current: ${currentStock.quantity}, Threshold: ${validatedData.threshold}`,
          status: 'sent',
        },
      })

      // Log the alert
      await prisma.transaction_logs.create({
        data: {
          entity_type: 'stocks',
          entity_id: currentStock.stock_id,
          action: 'CREATE',
          user_id: user.id,
          details: {
            action: 'low_stock_alert',
            product_id: validatedData.product_id,
            current_quantity: currentStock.quantity,
            threshold: validatedData.threshold,
            alert_triggered: true,
          },
        },
      })
    }

    return res.status(200).json({
      data: {
        product: currentStock.products,
        current_quantity: currentStock.quantity,
        threshold: validatedData.threshold,
        is_low_stock: isLowStock,
        alert_sent: isLowStock,
      },
      message: isLowStock 
        ? `Low stock alert triggered for ${currentStock.products.name}`
        : `Stock level is above threshold for ${currentStock.products.name}`,
    })
  } catch (error) {
    console.error('Stock alert error:', error)
    return res.status(500).json({
      error: 'Failed to process stock alert',
      code: 'ALERT_PROCESSING_FAILED',
    })
  }
}
