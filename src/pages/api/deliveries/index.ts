import { prisma } from "@/lib/prisma";
import { createCrudHandler } from "@/utils/crud-handler";
import { deliverySchema } from "@/utils/validation-schemas";

export default createCrudHandler({
  model: 'deliveries',
  prisma,
  validationSchema: deliverySchema,
  allowedRoles: ['admin', 'business_developer', 'driver'],
  enablePagination: true,
  enableSoftDelete: false,
  auditLog: true,
});
