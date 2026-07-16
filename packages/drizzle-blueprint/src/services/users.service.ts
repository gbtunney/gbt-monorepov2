// Src/services/users.service.ts
// Per-table service for `users`.
// Composes the generic CRUD service with typed query helpers.
//
// Exposes:
//   CRUD — create, getById, list, update, remove  (from makeCrudService)
//   getByEmail      — findOneByStrict on users.email (safe for unique columns)
//   searchByName    — LIKE search on users.name

import { makeCrudService } from './makeCrudService.js'
import { makeQueryHelpers } from './makeQueryHelpers.js'
import { db } from '../db/db.js'
import { users } from '../db/tables/users.table.js'

const q = makeQueryHelpers(db, users)
const base = makeCrudService(db, users, users.id)

export const usersService = {
    ...base,

    // Unique-ish lookup — throws at runtime if email appears more than once.
    // Paired with .unique() on the column for DB-level enforcement.
    getByEmail: q.findOneByStrict(users.email),

    // Full-text LIKE search across user names.
    searchByName: q.searchBy(users.name),
}

export default usersService
