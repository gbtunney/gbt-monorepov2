// Src/services/makeQueryHelpers.ts
// Generic typed query helper factory. Produces filtered / relational lookup
// helpers for any Drizzle SQLite table.
//
// Key pattern — inferred column value types:
//   type ColumnValue<TColumn extends SQLiteColumn> = TColumn["_"]["data"]
//
// This lets the return type of each helper be inferred directly from the
// column you pass in, so call sites get full type safety without extra
// type annotations.
//
// Helpers produced:
//   findManyBy(col)          — all rows where col = value
//   findOneBy(col)           — first row where col = value, or null
//   findOneByStrict(col)     — like findOneBy but throws if >1 row found
//   findManyByAnd(colA,colB) — all rows where colA = a AND colB = b
//   findManyByOr(colA,colB)  — all rows where colA = a OR colB = b
//   searchBy(col)            — LIKE %pattern% on text-like columns only

import { and, eq, like, or } from 'drizzle-orm'
import type { InferSelectModel } from 'drizzle-orm'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import type { AnySQLiteTable, SQLiteColumn } from 'drizzle-orm/sqlite-core'

// ============================================================
// ColumnValue — infers the data type for a given column.
// This is the core of the typed query helper pattern.
// makeCrudService does NOT use this — it works at the row level.
// ============================================================
type ColumnValue<TColumn extends SQLiteColumn> = TColumn['_']['data']

type QueryHelpers<TTable extends AnySQLiteTable> = {
    findManyBy<TColumn extends SQLiteColumn>(
        column: TColumn,
    ): (value: ColumnValue<TColumn>) => Promise<Array<InferSelectModel<TTable>>>
    findManyByAnd<TColumnA extends SQLiteColumn, TColumnB extends SQLiteColumn>(
        colA: TColumnA,
        colB: TColumnB,
    ): (
        valueA: ColumnValue<TColumnA>,
        valueB: ColumnValue<TColumnB>,
    ) => Promise<Array<InferSelectModel<TTable>>>
    findManyByOr<TColumnA extends SQLiteColumn, TColumnB extends SQLiteColumn>(
        colA: TColumnA,
        colB: TColumnB,
    ): (
        valueA: ColumnValue<TColumnA>,
        valueB: ColumnValue<TColumnB>,
    ) => Promise<Array<InferSelectModel<TTable>>>
    findOneBy<TColumn extends SQLiteColumn>(
        column: TColumn,
    ): (value: ColumnValue<TColumn>) => Promise<InferSelectModel<TTable> | null>
    findOneByStrict<TColumn extends SQLiteColumn>(
        column: TColumn,
    ): (value: ColumnValue<TColumn>) => Promise<InferSelectModel<TTable> | null>
    searchBy<TColumn extends TextColumn>(
        column: TColumn,
    ): (pattern: string) => Promise<Array<InferSelectModel<TTable>>>
}

type TextColumn = SQLiteColumn & {
    _: {
        data: TextLike
    }
}

// TextLike / TextColumn — restrict searchBy() to text columns only.
type TextLike = null | string

// ============================================================
// makeQueryHelpers — factory function
/** ============================================================ */
export function makeQueryHelpers<TTable extends AnySQLiteTable>(
    db: BetterSQLite3Database,
    table: TTable,
): QueryHelpers<TTable> {
    return {
        // ----------------------------------------------------------
        // findManyBy — generic filtered list lookup.
        // Typical use: child/foreign-key queries (e.g. all orders for a userId).
        //
        // Example:
        //   const listByUserId = q.findManyBy(orders.userId)
        /** ListByUserId(42) // infers argument as number */
        findManyBy<TColumn extends SQLiteColumn>(column: TColumn) {
            return (
                value: ColumnValue<TColumn>,
            ): Promise<Array<InferSelectModel<TTable>>> =>
                db.select().from(table).where(eq(column, value))
        },

        // ----------------------------------------------------------
        // findManyByAnd — compound AND filter across two columns.
        //
        // Example:
        //   const listByUserAndProduct = q.findManyByAnd(orders.userId, orders.product)
        /** ListByUserAndProduct(42, "keyboard") */
        findManyByAnd<
            TColumnA extends SQLiteColumn,
            TColumnB extends SQLiteColumn,
        >(colA: TColumnA, colB: TColumnB) {
            return (
                valueA: ColumnValue<TColumnA>,
                valueB: ColumnValue<TColumnB>,
            ): Promise<Array<InferSelectModel<TTable>>> =>
                db
                    .select()
                    .from(table)
                    .where(and(eq(colA, valueA), eq(colB, valueB)))
        },

        // ----------------------------------------------------------
        // findManyByOr — compound OR filter across two columns.
        //
        // Example:
        /** Const q.findManyByOr(orders.userId, orders.product) */
        findManyByOr<
            TColumnA extends SQLiteColumn,
            TColumnB extends SQLiteColumn,
        >(colA: TColumnA, colB: TColumnB) {
            return (
                valueA: ColumnValue<TColumnA>,
                valueB: ColumnValue<TColumnB>,
            ): Promise<Array<InferSelectModel<TTable>>> =>
                db
                    .select()
                    .from(table)
                    .where(or(eq(colA, valueA), eq(colB, valueB)))
        },

        // ----------------------------------------------------------
        // findOneBy — returns the first matching row, or null.
        // Does NOT throw on duplicates.
        //
        // Example:
        //   const getFirstByUserId = q.findOneBy(orders.userId)
        /** GetFirstByUserId(42) */
        findOneBy<TColumn extends SQLiteColumn>(column: TColumn) {
            return async (
                value: ColumnValue<TColumn>,
            ): Promise<InferSelectModel<TTable> | null> => {
                const rows = await db
                    .select()
                    .from(table)
                    .where(eq(column, value))
                    .limit(1)

                return rows[0] ?? null
            }
        },

        // ----------------------------------------------------------
        // findOneByStrict — returns the first matching row, or null.
        // Throws if more than one row is found (runtime uniqueness guard).
        // Best paired with columns that have a .unique() constraint at the DB level.
        //
        // Example:
        //   const getByEmail = q.findOneByStrict(users.email)
        /** GetByEmail("alice@example.com") */
        findOneByStrict<TColumn extends SQLiteColumn>(column: TColumn) {
            return async (
                value: ColumnValue<TColumn>,
            ): Promise<InferSelectModel<TTable> | null> => {
                const rows = await db
                    .select()
                    .from(table)
                    .where(eq(column, value))
                    .limit(2)

                if (rows.length > 1) {
                    throw new Error(
                        `Expected at most one row for column lookup, got ${String(rows.length)}.`,
                    )
                }

                return rows[0] ?? null
            }
        },

        // ----------------------------------------------------------
        // searchBy — LIKE %pattern% search. TEXT COLUMNS ONLY.
        // TypeScript will reject numeric columns at compile time via TextColumn.
        //
        // Example:
        //   const searchByName = q.searchBy(users.name)
        /** SearchByName("ali") // matches "Alice", "Malik", etc. */
        searchBy<TColumn extends TextColumn>(column: TColumn) {
            return (
                pattern: string,
            ): Promise<Array<InferSelectModel<TTable>>> =>
                db
                    .select()
                    .from(table)
                    .where(like(column, `%${pattern}%`))
        },
    }
}

export default makeQueryHelpers
