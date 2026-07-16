// Src/services/categories.service.ts
// Service for the `categories` table.
// Composes the generic CRUD service with typed query helpers, both imported from
// @gbt/drizzle-blueprint. The local `db` instance is passed as the first argument
// so the equipment package operates its own SQLite file (./dev.db), independent
// of the blueprint's database.
//
// Exposes:
//   CRUD — create, getById, list, update, remove  (from makeCrudService)
//   findByName    — findOneByStrict on categories.name (unique column)
//   searchByName  — LIKE %pattern% search on categories.name

import { makeCrudService, makeQueryHelpers } from '@gbt/drizzle-blueprint'

import { db } from '../db/db.js'
import { categories } from '../db/tables/categories.table.js'

const base = makeCrudService(db, categories, categories.id)
const q = makeQueryHelpers(db, categories)

export const categoriesService = {
    ...base,

    // Strict unique lookup — throws at runtime if name appears more than once.
    // Relies on the .unique() DB constraint on categories.name.
    findByName: q.findOneByStrict(categories.name),

    // LIKE search on category names.
    searchByName: q.searchBy(categories.name),
}

export default categoriesService
