// Src/index.test.ts
// Smoke tests — confirm that services are correctly composed and shaped.
//
// @gbt/drizzle-blueprint is mocked to avoid loading its bundled output, which
// pulls in express-zod-api. There is a known peer-dependency incompatibility
// between zod@>=4.4.0 and express-zod-api@26.x that triggers a
// "Cannot redefine property: brand" error at module init time.
//
// The endpoints wiring and Zod schema correctness are covered statically by the
// check:ts target (TypeScript validates those at compile time).
//
// All mock paths below are relative to THIS file (src/index.test.ts).
//

import { describe, expect, test, vi } from 'vitest'

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@gbt/drizzle-blueprint', () => ({
    // BaseColumns is spread into sqliteTable calls — not needed at test time
    // since table files are mocked below.
    baseColumns: {},
    makeCrudService: () => ({
        create: vi.fn(),
        getById: vi.fn(),
        list: vi.fn(),
        remove: vi.fn(),
        update: vi.fn(),
    }),
    makeQueryHelpers: () => ({
        findManyBy: () => vi.fn(),
        findManyByAnd: () => vi.fn(),
        findManyByOr: () => vi.fn(),
        findOneBy: () => vi.fn(),
        findOneByStrict: () => vi.fn(),
        searchBy: () => vi.fn(),
    }),
}))

// Prevent better-sqlite3 from opening a real file during tests.
// Path is relative to this test file (src/index.test.ts) → src/db/db.ts
vi.mock('./db/db.js', () => ({ db: {}, default: {} }))

// Minimal table stubs — service files import these; the column values are passed
// to makeQueryHelpers helper factories which are also mocked above.
vi.mock('./db/tables/categories.table.js', () => ({
    categories: { description: {}, id: {}, name: {} },
}))

vi.mock('./db/tables/equipment.table.js', () => ({
    equipment: {
        categoryId: {},
        description: {},
        id: {},
        location: {},
        name: {},
        serialNumber: {},
        status: {},
    },
}))

// ─── Imports ──────────────────────────────────────────────────────────────────

import { categoriesService } from './services/categories.service.js'
import { equipmentService } from './services/equipment.service.js'

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('@gbt/drizzle-equipment | smoke', () => {
    describe('categoriesService', () => {
        test('exposes standard CRUD methods', () => {
            expect(typeof categoriesService.create).toBe('function')
            expect(typeof categoriesService.getById).toBe('function')
            expect(typeof categoriesService.list).toBe('function')
            expect(typeof categoriesService.update).toBe('function')
            expect(typeof categoriesService.remove).toBe('function')
        })

        test('exposes custom query helpers', () => {
            expect(typeof categoriesService.findByName).toBe('function')
            expect(typeof categoriesService.searchByName).toBe('function')
        })
    })

    describe('equipmentService', () => {
        test('exposes standard CRUD methods', () => {
            expect(typeof equipmentService.create).toBe('function')
            expect(typeof equipmentService.getById).toBe('function')
            expect(typeof equipmentService.list).toBe('function')
            expect(typeof equipmentService.update).toBe('function')
            expect(typeof equipmentService.remove).toBe('function')
        })

        test('exposes custom query helpers', () => {
            expect(typeof equipmentService.findBySerial).toBe('function')
            expect(typeof equipmentService.listByCategory).toBe('function')
            expect(typeof equipmentService.listByStatus).toBe('function')
            expect(typeof equipmentService.searchByName).toBe('function')
        })
    })
})
