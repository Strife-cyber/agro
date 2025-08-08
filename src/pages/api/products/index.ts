import { prisma } from "@/lib/prisma";
import { createCrudHandler } from "@/utils/crud-handler";
import { productSchema } from "@/utils/validation-schemas";

// Create a CRUD handler for the 'products' model with validation and role-based access
export default createCrudHandler({
  model: 'products',
  prisma,
  validationSchema: productSchema,
  allowedRoles: ['admin', 'business_developer', 'stock_manager'], // Admins, business developers, and stock managers can manage products
  enablePagination: true,
  enableSoftDelete: true,
  auditLog: true,
});
