import { z } from 'zod'

// Base schemas for common fields
const baseFields = {
  id: z.string().uuid().optional(),
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
}

// User validation schema
export const userSchema = z.object({
  ...baseFields,
  email: z.string().email(),
  name: z.string().min(1).max(100),
  phone: z.string().max(20).optional(),
  address: z.string().optional(),
  role: z.enum(['admin', 'business_developer', 'stock_manager', 'supplier', 'client', 'driver']).default('client'),
})

// Product validation schema
export const productSchema = z.object({
  ...baseFields,
  category_id: z.string().uuid().optional(),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  unit: z.string().min(1).max(20),
  image_url: z.string().url().optional(),
})

// Category validation schema
export const categorySchema = z.object({
  ...baseFields,
  name: z.string().min(1).max(50),
  description: z.string().optional(),
})

// Warehouse validation schema
export const warehouseSchema = z.object({
  ...baseFields,
  name: z.string().min(1).max(100),
  address: z.string().min(1),
})

// Stock validation schema
export const stockSchema = z.object({
  ...baseFields,
  product_id: z.string().uuid(),
  warehouse_id: z.string().uuid(),
  quantity: z.number().positive(),
  unit_price: z.number().positive(),
  approvisionnement_id: z.string().uuid().optional(),
})

// Approvisionnement validation schema
export const approvisionnementSchema = z.object({
  ...baseFields,
  supplier_id: z.string(),
  product_id: z.string().uuid(),
  warehouse_id: z.string().uuid(),
  quantity: z.number().positive(),
  proposed_price: z.number().positive(),
  delivery_date: z.date(),
  status: z.enum(['pending', 'validated_bd', 'received', 'rejected']).default('pending'),
  business_developer_id: z.string().optional(),
  stock_manager_id: z.string().optional(),
})

// Order validation schema
export const orderSchema = z.object({
  ...baseFields,
  client_id: z.string(),
  warehouse_id: z.string().uuid(),
  total_amount: z.number().positive(),
  status: z.enum(['pending', 'paid', 'shipped', 'delivered', 'cancelled']).default('pending'),
  delivery_option: z.boolean().default(false),
  delivery_address: z.string().optional(),
  payment_method: z.enum(['direct', 'credit']),
})

// Order Item validation schema
export const orderItemSchema = z.object({
  ...baseFields,
  order_id: z.string().uuid(),
  product_id: z.string().uuid(),
  quantity: z.number().positive(),
  unit_price: z.number().positive(),
})

// Delivery validation schema
export const deliverySchema = z.object({
  ...baseFields,
  order_id: z.string().uuid(),
  driver_id: z.string().optional(),
  status: z.enum(['assigned', 'in_transit', 'delivered', 'failed']).default('assigned'),
  eta: z.date().optional(),
  delivery_date: z.date().optional(),
})

// Payment validation schema
export const paymentSchema = z.object({
  ...baseFields,
  order_id: z.string().uuid().optional(),
  approvisionnement_id: z.string().uuid().optional(),
  amount: z.number().positive(),
  payment_date: z.date().optional(),
  status: z.enum(['pending', 'completed', 'failed']).default('pending'),
  payment_method: z.enum(['direct', 'credit']),
})

// Notification validation schema
export const notificationSchema = z.object({
  ...baseFields,
  user_id: z.string(),
  order_id: z.string().uuid().optional(),
  delivery_id: z.string().uuid().optional(),
  type: z.enum(['email', 'sms']),
  message: z.string().min(1),
  status: z.enum(['sent', 'failed']).default('sent'),
})

// Partial schemas for updates
export const partialUserSchema = userSchema.partial()
export const partialProductSchema = productSchema.partial()
export const partialCategorySchema = categorySchema.partial()
export const partialWarehouseSchema = warehouseSchema.partial()
export const partialStockSchema = stockSchema.partial()
export const partialApprovisionnementSchema = approvisionnementSchema.partial()
export const partialOrderSchema = orderSchema.partial()
export const partialOrderItemSchema = orderItemSchema.partial()
export const partialDeliverySchema = deliverySchema.partial()
export const partialPaymentSchema = paymentSchema.partial()
export const partialNotificationSchema = notificationSchema.partial()

// Query parameter schemas
export const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
})

export const searchSchema = z.object({
  query: z.string().min(1).optional(),
  filters: z.record(z.any()).optional(),
})

// Export all schemas for easy access
export const schemas = {
  user: userSchema,
  product: productSchema,
  category: categorySchema,
  warehouse: warehouseSchema,
  stock: stockSchema,
  approvisionnement: approvisionnementSchema,
  order: orderSchema,
  orderItem: orderItemSchema,
  delivery: deliverySchema,
  payment: paymentSchema,
  notification: notificationSchema,
  pagination: paginationSchema,
  search: searchSchema,
}
