// Src/services/makeCrudService.ts
// Generic CRUD service factory. Produces create / getById / list / update / remove
// for any Drizzle SQLite table that follows the baseColumns convention.
//
// Type strategy (row-level, not column-level):
//   - InferSelectModel<TTable> for returned rows
//   - InferInsertModel<TTable> for inserts
//   - Partial<InferInsertModel<TTable>> for updates
//
// Column-level inference (ColumnValue<TColumn>) is NOT needed here — that lives
// in makeQueryHelpers.ts where individual columns are passed as parameters.
//
// CrudService<TSelect, TInsert, TUpdate> is exported so makeCrudEndpoints.ts
// can import the type directly instead of redeclaring it.
//
// db is accepted as a first parameter (dependency injection) so that consumers
// in other packages can supply their own database connection rather than sharing
// this package's internal singleton. Pass the result of drizzle(sqlite) here.

import { eq } from 'drizzle-orm'
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import type { AnySQLiteTable, SQLiteColumn } from 'drizzle-orm/sqlite-core'

// ============================================================
// CrudService — exported type contract
// Import this in makeCrudEndpoints.ts instead of redeclaring.
// ============================================================
export type CrudService<TSelect, TInsert, TUpdate = Partial<TInsert>> = {
    create(input: TInsert): Promise<TSelect>
    getById(id: number): Promise<null | TSelect>
    list(): Promise<Array<TSelect>>
    remove(id: number): Promise<null | TSelect>
    update(id: number, patch: TUpdate): Promise<null | TSelect>
}

// Applied during update() to keep datetime_modified in sync.
// Only used internally — callers never need to set this manually.
type TimestampPatch = {
    datetime_modified?: Date
}

// ============================================================
// makeCrudService — factory function
/** ============================================================ */
export function makeCrudService<
    TTable extends AnySQLiteTable,
    TSelect = InferSelectModel<TTable>,
    TInsert = InferInsertModel<TTable>,
    TUpdate = Partial<InferInsertModel<TTable>>,
>(
    db: BetterSQLite3Database,
    table: TTable,
    idColumn: SQLiteColumn,
): CrudService<TSelect, TInsert, TUpdate> {
    return {
        async create(input): Promise<TSelect> {
            const rows = await db
                .insert(table)
                .values(input as never)
                .returning()
            return rows[0] as TSelect
        },

        async getById(id): Promise<null | TSelect> {
            const rows = await db
                .select()
                .from(table)
                .where(eq(idColumn, id))
                .limit(1)

            return (rows[0] as TSelect | undefined) ?? null
        },

        async list(): Promise<Array<TSelect>> {
            const rows = await db.select().from(table)
            return rows as Array<TSelect>
        },

        async remove(id): Promise<null | TSelect> {
            const rows = await db
                .delete(table)
                .where(eq(idColumn, id))
                .returning()

            return (rows[0] as TSelect | undefined) ?? null
        },

        async update(id, patch): Promise<null | TSelect> {
            // Automatically patch datetime_modified so callers don't have to.
            // If a table lacks this column, this is a no-op at the SQL level
            // (Drizzle ignores unknown columns in set()).
            const updatePatch = {
                ...(patch as object),
                datetime_modified: new Date(),
            } as TimestampPatch & TUpdate

            const rows = await db
                .update(table)
                .set(updatePatch as never)
                .where(eq(idColumn, id))
                .returning()

            return (rows[0] as TSelect | undefined) ?? null
        },
    }
}
