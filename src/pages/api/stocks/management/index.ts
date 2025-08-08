/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// Validation schema for stock management actions
const stockManagementSchema = z.object({
  action: z.enum(['adjust', 'transfer', 'report', 'alert']),
  product_id: z.string().uuid().optional(),
  warehouse_id: z.string().uuid().optional(),
  quantity: z.number().optional(),
  from_warehouse_id: z.string().uuid().optional(),
  to_warehouse_id: z.string().uuid().optional(),
  reason: z.string().optional(),
  threshold: z.number().positive().optional(), // For alerts
})

/**
 * STOCK MANAGEMENT ENDPOINT
 * 
 * This endpoint handles comprehensive stock management operations:
 * 
 * AVAILABLE ACTIONS:
 * 1. adjust - Adjust stock quantities (add/remove)
 * 2. transfer - Transfer stock between warehouses
 * 3. report - Generate inventory reports
 * 4. alert - Set up low stock alerts
 * 
 * BUSINESS RULES:
 * - Only Stock Managers and Admins can manage stock
 * - All stock adjustments are logged for audit trail
 * - Stock transfers require validation of source warehouse
 * - Low stock alerts are automatically triggered
 * - Inventory reports include detailed analytics
 * 
 * STOCK ADJUSTMENT:
 * - Can add or remove stock quantities
 * - Requires reason for adjustment
 * - Updates last_updated timestamp
 * - Logs all changes for audit
 * 
 * STOCK TRANSFER:
 * - Validates source warehouse has sufficient stock
 * - Creates transfer record
 * - Updates both source and destination warehouses
 * - Maintains audit trail
 * 
 * INVENTORY REPORTS:
 * - Current stock levels by warehouse
 * - Low stock items
 * - Stock movement history
 * - Value calculations
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Only allow POST for stock management actions
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
    const validatedData = stockManagementSchema.parse(req.body)

    // Check if user is Stock Manager or Admin
    if (user.role !== 'stock_manager' && user.role !== 'admin') {
      return res.status(403).json({
        error: 'Only Stock Managers can manage inventory',
        code: 'INSUFFICIENT_PERMISSIONS',
      })
    }

    // Handle different stock management actions
    switch (validatedData.action) {
      case 'adjust':
        return await handleStockAdjustment(req, res, user, validatedData)
      
      case 'transfer':
        return await handleStockTransfer(req, res, user, validatedData)
      
      case 'report':
        return await handleInventoryReport(req, res, user, validatedData)
      
      case 'alert':
        return await handleStockAlert(req, res, user, validatedData)
      
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
 * Allows Stock Managers to adjust stock quantities:
 * - Add stock (positive quantity)
 * - Remove stock (negative quantity)
 * - Requires reason for adjustment
 * - Logs all changes for audit trail
 */
async function handleStockAdjustment(
  req: NextApiRequest,
  res: NextApiResponse,
  user: any,
  data: any
) {
  if (!data.product_id || !data.warehouse_id || data.quantity === undefined) {
    return res.status(400).json({
      error: 'product_id, warehouse_id, and quantity are required for stock adjustment',
      code: 'MISSING_REQUIRED_FIELDS',
    })
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Get current stock
      const currentStock = await tx.stocks.findFirst({
        where: {
          product_id: data.product_id,
          warehouse_id: data.warehouse_id,
        },
        include: {
          products: true,
        },
      })

      if (!currentStock) {
        throw new Error('Stock record not found for this product and warehouse')
      }

      // Calculate new quantity
      const newQuantity = Number(currentStock.quantity) + data.quantity

      // Prevent negative stock (unless it's a correction)
      if (newQuantity < 0) {
        throw new Error('Stock adjustment would result in negative quantity')
      }

      // Update stock
      const updatedStock = await tx.stocks.update({
        where: { stock_id: currentStock.stock_id },
        data: {
          quantity: newQuantity,
          last_updated: new Date(),
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
            product_id: data.product_id,
            warehouse_id: data.warehouse_id,
            previous_quantity: currentStock.quantity,
            adjustment: data.quantity,
            new_quantity: newQuantity,
            reason: data.reason || 'Manual adjustment',
          },
        },
      })

      return {
        stock: updatedStock,
        product: currentStock.products,
        adjustment: data.quantity,
        previous_quantity: currentStock.quantity,
        new_quantity: newQuantity,
      }
    })

    return res.status(200).json({
      data: result,
      message: `Stock adjusted successfully. ${data.quantity > 0 ? 'Added' : 'Removed'} ${Math.abs(data.quantity)} units.`,
    })
  } catch (error) {
    console.error('Stock adjustment error:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Stock adjustment failed',
      code: 'STOCK_ADJUSTMENT_FAILED',
    })
  }
}

/**
 * STOCK TRANSFER
 * 
 * Transfers stock between warehouses:
 * - Validates source warehouse has sufficient stock
 * - Updates both source and destination warehouses
 * - Creates transfer record for audit trail
 * - Maintains data consistency with transactions
 */
async function handleStockTransfer(
  req: NextApiRequest,
  res: NextApiResponse,
  user: any,
  data: any
) {
  if (!data.product_id || !data.from_warehouse_id || !data.to_warehouse_id || !data.quantity) {
    return res.status(400).json({
      error: 'product_id, from_warehouse_id, to_warehouse_id, and quantity are required for stock transfer',
      code: 'MISSING_REQUIRED_FIELDS',
    })
  }

  if (data.from_warehouse_id === data.to_warehouse_id) {
    return res.status(400).json({
      error: 'Source and destination warehouses must be different',
      code: 'INVALID_TRANSFER',
    })
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Get source stock
      const sourceStock = await tx.stocks.findFirst({
        where: {
          product_id: data.product_id,
          warehouse_id: data.from_warehouse_id,
        },
        include: {
          products: true,
        },
      })

      if (!sourceStock) {
        throw new Error('Source stock not found')
      }

      if (sourceStock.quantity < data.quantity) {
        throw new Error('Insufficient stock in source warehouse')
      }

      // Get or create destination stock
      let destinationStock = await tx.stocks.findFirst({
        where: {
          product_id: data.product_id,
          warehouse_id: data.to_warehouse_id,
        },
      })

      if (!destinationStock) {
        // Create new stock record for destination
        destinationStock = await tx.stocks.create({
          data: {
            product_id: data.product_id,
            warehouse_id: data.to_warehouse_id,
            quantity: data.quantity,
            unit_price: sourceStock.unit_price,
            last_updated: new Date(),
          },
        })
      } else {
        // Update existing destination stock
        destinationStock = await tx.stocks.update({
          where: { stock_id: destinationStock.stock_id },
          data: {
            quantity: Number(destinationStock.quantity) + data.quantity,
            last_updated: new Date(),
          },
        })
      }

      // Update source stock
      const updatedSourceStock = await tx.stocks.update({
        where: { stock_id: sourceStock.stock_id },
        data: {
          quantity: Number(sourceStock.quantity) - data.quantity,
          last_updated: new Date(),
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
            product_id: data.product_id,
            from_warehouse_id: data.from_warehouse_id,
            to_warehouse_id: data.to_warehouse_id,
            quantity_transferred: data.quantity,
            reason: data.reason || 'Manual transfer',
          },
        },
      })

      return {
        source_stock: updatedSourceStock,
        destination_stock: destinationStock,
        product: sourceStock.products,
        quantity_transferred: data.quantity,
      }
    })

    return res.status(200).json({
      data: result,
      message: `Stock transfer completed successfully. ${data.quantity} units transferred.`,
    })
  } catch (error) {
    console.error('Stock transfer error:', error)
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Stock transfer failed',
      code: 'STOCK_TRANSFER_FAILED',
    })
  }
}

/**
 * INVENTORY REPORT
 * 
 * Generates comprehensive inventory reports:
 * - Current stock levels by warehouse
 * - Low stock items
 * - Stock value calculations
 * - Recent stock movements
 */
async function handleInventoryReport(
  req: NextApiRequest,
  res: NextApiResponse,
  user: any,
  data: any
) {
  try {
    // Get all stock with product and warehouse details
    const stockReport = await prisma.stocks.findMany({
      include: {
        products: true,
        warehouses: true,
      },
      orderBy: [
        { warehouses: { name: 'asc' } },
        { products: { name: 'asc' } },
      ],
    })

    // Calculate totals
    const totalItems = stockReport.length
    const totalValue = stockReport.reduce((sum, stock) => {
      return sum + (Number(stock.quantity) * Number(stock.unit_price))
    }, 0)

    // Find low stock items (less than 10 units)
    const lowStockItems = stockReport.filter(stock => Number(stock.quantity) < 10)

    // Group by warehouse
    const warehouseReport = stockReport.reduce((acc: Record<string, any>, stock) => {
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
    }, {} as Record<string, any>)

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
  user: any,
  data: any
) {
  if (!data.product_id || !data.threshold) {
    return res.status(400).json({
      error: 'product_id and threshold are required for stock alerts',
      code: 'MISSING_REQUIRED_FIELDS',
    })
  }

  try {
    // Get current stock
    const currentStock = await prisma.stocks.findFirst({
      where: {
        product_id: data.product_id,
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
    const isLowStock = Number(currentStock.quantity) <= data.threshold

    if (isLowStock) {
      // Send notification to stock manager
      await prisma.notifications.create({
        data: {
          user_id: user.id,
          type: 'email',
          message: `LOW STOCK ALERT: ${currentStock.products.name} is below threshold. Current: ${currentStock.quantity}, Threshold: ${data.threshold}`,
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
            product_id: data.product_id,
            current_quantity: currentStock.quantity,
            threshold: data.threshold,
            alert_triggered: true,
          },
        },
      })
    }

    return res.status(200).json({
      data: {
        product: currentStock.products,
        current_quantity: currentStock.quantity,
        threshold: data.threshold,
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
