import { prisma } from "@/lib/prisma";
import { createCrudHandler } from "@/utils/crud-handler";
import { orderItemSchema } from "@/utils/validation-schemas";

export default createCrudHandler({
  model: 'order_items',
  prisma,
  validationSchema: orderItemSchema,
  allowedRoles: ['admin', 'business_developer', 'stock_manager'],
  enablePagination: true,
  enableSoftDelete: false,
  auditLog: true,
});
