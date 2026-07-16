// Src/services/orders.service.ts
// Per-table service for `orders`.
// Composes the generic CRUD service with typed query helpers.
// Demonstrates the foreign-key child pattern (userId -> users.id).
//
// Exposes:
//   CRUD — create, getById, list, update, remove  (from makeCrudService)
//   listByUserId          — all orders for a given userId
//   getFirstByUserId      — first order for a userId (or null)
//   listByUserAndProduct  — AND filter: userId + product name
//   searchProducts        — LIKE search on orders.product

import { makeCrudService } from './makeCrudService.js'
import { makeQueryHelpers } from './makeQueryHelpers.js'
import { db } from '../db/db.js'
import { orders } from '../db/tables/orders.table.js'

const q = makeQueryHelpers(db, orders)
const base = makeCrudService(db, orders, orders.id)

export const ordersService = {
    ...base,

    // Returns first match only. Useful when you expect at most one active order.
    getFirstByUserId: q.findOneBy(orders.userId),

    // Compound AND — narrow by both user and product name.
    listByUserAndProduct: q.findManyByAnd(orders.userId, orders.product),

    // Child lookup — all orders belonging to a user.
    listByUserId: q.findManyBy(orders.userId),

    // LIKE search across product names.
    searchProducts: q.searchBy(orders.product),
}

export default ordersService
