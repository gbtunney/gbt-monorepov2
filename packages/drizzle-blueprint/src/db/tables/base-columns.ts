// Src/db/tables/base-columns.ts
// Shared column definitions spread into every table.
// Provides: id (PK, autoincrement), datetime_created, datetime_modified.
//
// NOTE: SQLite does NOT auto-update datetime_modified on UPDATE.
// You must set it manually in update operations (makeCrudService.ts handles this).

import { sql } from 'drizzle-orm'
import { integer } from 'drizzle-orm/sqlite-core'

export const baseColumns = {
    datetime_created: integer('datetime_created', { mode: 'timestamp' })
        .notNull()
        .default(sql`(unixepoch())`),

    datetime_modified: integer('datetime_modified', { mode: 'timestamp' })
        .notNull()
        .default(sql`(unixepoch())`),

    id: integer('id').primaryKey({ autoIncrement: true }),
}

export default baseColumns
