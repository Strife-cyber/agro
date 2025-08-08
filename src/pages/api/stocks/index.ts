import { prisma } from "@/lib/prisma";
import { createCrudHandler } from "@/utils/crud-handler";
import { stockSchema } from "@/utils/validation-schemas";

export default createCrudHandler({
  model: 'stocks',
  prisma,
  validationSchema: stockSchema,
  allowedRoles: ['admin', 'business_developer', 'stock_manager'],
  enablePagination: true,
  enableSoftDelete: false,
  auditLog: true,
});
