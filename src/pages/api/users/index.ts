import { prisma } from "@/lib/prisma";
import { createCrudHandler } from "@/utils/crud-handler";
import { userSchema } from "@/utils/validation-schemas";

// Create a CRUD handler for the 'users' model with validation and role-based access
export default createCrudHandler({
  model: 'users',
  prisma,
  validationSchema: userSchema,
  allowedRoles: ['admin', 'business_developer'], // Only admins and business developers can manage users
  enablePagination: true,
  enableSoftDelete: true,
  auditLog: true,
});
