import { prisma } from "@/lib/prisma";
import { createCrudHandler } from "@/utils/crud-handler";

export default createCrudHandler({
  model: 'transaction_logs',
  prisma,
  validationSchema: undefined, // Transaction logs are read-only
  allowedRoles: ['admin', 'business_developer', 'stock_manager'],
  enablePagination: true,
  enableSoftDelete: false,
  auditLog: false, // Don't log audit logs
});
