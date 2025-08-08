import { prisma } from "@/lib/prisma";
import { createCrudHandler } from "@/utils/crud-handler";
import { z } from "zod";

// Simple test schema
const testSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  value: z.number().positive(),
});

// Test CRUD handler
export default createCrudHandler({
  model: 'categories', // Using categories as a test model
  prisma,
  validationSchema: testSchema,
  allowedRoles: ['admin'], // Only admins for testing
  enablePagination: true,
  enableSoftDelete: false,
  auditLog: true,
});
