import { prisma } from "@/lib/prisma";
import { createCrudHandler } from "@/utils/crud-handler";

// Create a CRUD handler for the 'users' model
export default createCrudHandler('roles', prisma);
