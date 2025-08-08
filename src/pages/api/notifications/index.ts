import { prisma } from "@/lib/prisma";
import { createCrudHandler } from "@/utils/crud-handler";
import { notificationSchema } from "@/utils/validation-schemas";

export default createCrudHandler({
  model: 'notifications',
  prisma,
  validationSchema: notificationSchema,
  allowedRoles: ['admin', 'business_developer', 'stock_manager'],
  enablePagination: true,
  enableSoftDelete: false,
  auditLog: true,
});
