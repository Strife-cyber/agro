import { prisma } from "@/lib/prisma";
import { createCrudHandler } from "@/utils/crudHandler";

// Create a CRUD handler for the 'users' model
export default createCrudHandler('roles', prisma);
