import { prisma } from "@/lib/prisma";
import { createCrudHandler } from "@/utils/crud-handler";
import { categorySchema } from "@/utils/validation-schemas";

export default createCrudHandler({
  model: 'categories',
  prisma,
  validationSchema: categorySchema,
  allowedRoles: ['admin', 'business_developer'],
  enablePagination: true,
  enableSoftDelete: true,
  auditLog: true,
});
