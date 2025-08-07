// src/utils/crudHandler.ts
import { PrismaClient } from '@/generated/prisma'
import { NextApiRequest, NextApiResponse } from 'next'

// Get type-safe keys from PrismaClient that map to model delegates
type ModelKeys = Extract<
  keyof PrismaClient,
  string
>

export const createCrudHandler = <T extends ModelKeys>(
  model: T,
  prisma: PrismaClient
) => {
  return async function handler(req: NextApiRequest, res: NextApiResponse) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const delegate = prisma[model] as any  // 👈 fix: TypeScript can't infer method signatures on generic access

    try {
      switch (req.method) {
        case 'GET':
          const all = await delegate.findMany()
          return res.status(200).json(all)

        case 'POST':
          const created = await delegate.create({ data: req.body })
          return res.status(201).json(created)

        case 'PUT':
          const updated = await delegate.update({
            where: { id: req.body.id },
            data: req.body,
          })
          return res.status(200).json(updated)

        case 'DELETE':
          const deleted = await delegate.delete({
            where: { id: req.body.id },
          })
          return res.status(200).json(deleted)

        default:
          return res.status(405).json({ message: 'Method Not Allowed' })
      }
    } catch (err) {
      console.error(err)
      return res.status(500).json({ error: 'Server Error' })
    }
  }
}
