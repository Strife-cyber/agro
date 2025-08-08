import { prisma } from "@/lib/prisma";
import { createCrudHandler } from "@/utils/crud-handler";
import { approvisionnementSchema } from "@/utils/validation-schemas";

// Create a CRUD handler for the 'approvisionnements' model with validation and role-based access
export default createCrudHandler({
  model: 'approvisionnements',
  prisma,
  validationSchema: approvisionnementSchema,
  allowedRoles: ['admin', 'business_developer', 'stock_manager', 'supplier'], // Admins, business developers, stock managers, and suppliers can manage approvisionnements
  enablePagination: true,
  enableSoftDelete: true,
  auditLog: true,
});
