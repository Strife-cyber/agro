import { prisma } from "@/lib/prisma";
import { createCrudHandler } from "@/utils/crud-handler";
import { warehouseSchema } from "@/utils/validation-schemas";

export default createCrudHandler({
  model: 'warehouses',
  prisma,
  validationSchema: warehouseSchema,
  allowedRoles: ['admin', 'business_developer'],
  enablePagination: true,
  enableSoftDelete: true,
  auditLog: true,
});
