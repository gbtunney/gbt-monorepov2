// Src/services/equipment.service.ts
// Service for the `equipment` table.
// Composes the generic CRUD service with typed query helpers, both imported from
// @gbt/drizzle-blueprint. The local `db` instance is passed so this package
// operates its own SQLite file independently.
//
// Exposes:
//   CRUD — create, getById, list, update, remove  (from makeCrudService)
//   findBySerial     — findOneByStrict on equipment.serialNumber (unique column)
//   listByCategory   — all equipment for a given category_id
//   listByStatus     — all equipment with a given status value
//   searchByName     — LIKE %pattern% search on equipment.name

import { makeCrudService, makeQueryHelpers } from '@gbt/drizzle-blueprint'

import { db } from '../db/db.js'
import { equipment } from '../db/tables/equipment.table.js'

const base = makeCrudService(db, equipment, equipment.id)
const q = makeQueryHelpers(db, equipment)

export const equipmentService = {
    ...base,

    // Unique lookup — serial_number has a .unique() DB constraint.
    findBySerial: q.findOneByStrict(equipment.serialNumber),

    // Child lookup — all equipment items under a given category.
    listByCategory: q.findManyBy(equipment.categoryId),

    // Status filter — pass 'available' | 'in_use' | 'maintenance'.
    listByStatus: q.findManyBy(equipment.status),

    // LIKE search across equipment names.
    searchByName: q.searchBy(equipment.name),
}

export default equipmentService
