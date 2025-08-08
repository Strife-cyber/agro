// /pages/api/stack-webhook.ts or /api/stack-webhook.js if using app router
import { prisma } from '@/lib/prisma'
import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { type, data } = req.body

  try {
    switch (type) {
      case 'user.created':
        await prisma.users.upsert({
          where: { id: data.id },
          update: {},
          create: {
            id: data.id,
            email: data.primary_email,
            name: data.display_name || '',
            created_at: new Date(),
          },
        })
        break

      case 'user.updated':
        await prisma.users.update({
          where: { id: data.id },
          data: {
            email: data.primary_email,
            name: data.display_name || '',
            updated_at: new Date(),
          },
        })
        break

      case 'user.deleted':
        await prisma.users.delete({
          where: { id: data.id },
        })
        break

      default:
        console.warn(`Unhandled event: ${type}`)
    }

    res.status(200).json({ status: 'ok' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Internal Error' })
  }
}
