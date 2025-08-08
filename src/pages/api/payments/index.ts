import { prisma } from "@/lib/prisma";
import { createCrudHandler } from "@/utils/crud-handler";
import { paymentSchema } from "@/utils/validation-schemas";

export default createCrudHandler({
  model: 'payments',
  prisma,
  validationSchema: paymentSchema,
  allowedRoles: ['admin', 'business_developer'],
  enablePagination: true,
  enableSoftDelete: false,
  auditLog: true,
});
