// Src/db/tables/table-factory.ts
// Optional convenience wrapper around sqliteTable that automatically spreads
// baseColumns into every table definition.
//
// Purpose:
//   - Guarantees every table gets id, datetime_created, datetime_modified.
//   - Reduces repeated `...baseColumns` boilerplate at the call site.
//   - drizzle-kit works with this as long as exported table definitions are
//     reachable from the tables barrel (index.ts).
//
// This is a schema-layer helper only. It is NOT related to the CRUD service
// or endpoint factory.

import type {
    AnySQLiteTable,
    SQLiteColumnBuilderBase,
} from 'drizzle-orm/sqlite-core'
import { sqliteTable } from 'drizzle-orm/sqlite-core'

import { baseColumns } from './base-columns.js'

export function makeAppTable<
    TName extends string,
    TColumns extends Record<string, SQLiteColumnBuilderBase>,
>(name: TName, columns: TColumns): AnySQLiteTable {
    return sqliteTable(name, {
        ...baseColumns,
        ...columns,
    })
}

export default makeAppTable
