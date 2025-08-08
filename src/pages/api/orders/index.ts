import { prisma } from "@/lib/prisma";
import { createCrudHandler } from "@/utils/crud-handler";
import { orderSchema } from "@/utils/validation-schemas";

// Create a CRUD handler for the 'orders' model with validation and role-based access
export default createCrudHandler({
  model: 'orders',
  prisma,
  validationSchema: orderSchema,
  allowedRoles: ['admin', 'client', 'stock_manager'], // Admins, clients (for their own orders), and stock managers can manage orders
  enablePagination: true,
  enableSoftDelete: true,
  auditLog: true,
});
