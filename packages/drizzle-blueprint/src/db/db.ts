// Src/db/db.ts
// Database connection only.
// Do NOT put schema definitions, services, or endpoints here.
// Keep this file tiny — one export: `db`.

import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'

const sqlite = new Database('./dev.db')

// SQLite foreign keys are disabled by default; enable them at connection time.
sqlite.pragma('foreign_keys = ON')

export const db = drizzle(sqlite)

export default db
