// Src/db/db.ts
// Equipment database connection.
// Separate SQLite file from drizzle-blueprint's dev.db — each package owns its own data.
// Foreign keys are enabled so the category_id → categories.id constraint is enforced.

import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'

const sqlite = new Database('./dev.db')

sqlite.pragma('foreign_keys = ON')

export const db = drizzle(sqlite)

export default db
