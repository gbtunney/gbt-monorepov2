// Src/db/zod/orders.zod.ts
// Zod schemas derived from the orders table definition.
// Same pattern as users.zod.ts — select / insert / update.

import {
    createInsertSchema,
    createSelectSchema,
    createUpdateSchema,
} from 'drizzle-zod'

import { orders } from '../tables/orders.table.js'

export const orderSelectSchema = createSelectSchema(orders)
export const orderInsertSchema = createInsertSchema(orders)
export const orderUpdateSchema = createUpdateSchema(orders)
