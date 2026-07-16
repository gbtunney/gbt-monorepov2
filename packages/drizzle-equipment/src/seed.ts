// Src/seed.ts
// Seed script — populates dev.db with sample categories and equipment.
// Run from the package root:
//   pnpm exec tsx src/seed.ts
//
// The script is idempotent: it wipes existing rows first so you can
// run it multiple times to reset to a known state.
//
// After seeding, browse the data with:
//   pnpm exec drizzle-kit studio

import { db } from './db/db.js'
import { categories } from './db/tables/categories.table.js'
import { equipment } from './db/tables/equipment.table.js'

// ── Wipe existing data (FK-ordered: equipment first, then categories) ─────────
await db.delete(equipment)
await db.delete(categories)

// ── Seed categories ───────────────────────────────────────────────────────────
const [powerTools, handTools, safety, measurement, electrical] = await db
    .insert(categories)
    .values([
        {
            description:
                'Electric and battery-powered tools for cutting, drilling, and fastening.',
            name: 'Power Tools',
        },
        {
            description:
                'Non-powered tools operated manually, including hammers, wrenches, and screwdrivers.',
            name: 'Hand Tools',
        },
        {
            description:
                'Personal protective equipment and safety devices required on-site.',
            name: 'Safety Equipment',
        },
        {
            description:
                'Instruments for measuring dimensions, levels, and marking layouts.',
            name: 'Measurement & Layout',
        },
        {
            description:
                'Electrical testing equipment, cable tools, and related accessories.',
            name: 'Electrical',
        },
    ])
    .returning()

console.log(`✓ Inserted 5 categories`)

// Null-safe IDs (they are always present after INSERT … RETURNING)
const powerToolsId = powerTools.id
const handToolsId = handTools.id
const safetyId = safety.id
const measurementId = measurement.id
const electricalId = electrical.id

// ── Seed equipment ────────────────────────────────────────────────────────────
const items = await db
    .insert(equipment)
    .values([
        // Power Tools
        {
            categoryId: powerToolsId,
            description: '1/2 in. drill/driver with 2-speed transmission.',
            location: 'Tool Crib A',
            name: 'DeWalt 20V Cordless Drill',
            serialNumber: 'DW-001',
            status: 'available',
        },
        {
            categoryId: powerToolsId,
            description: '7-1/4 in. circular saw, 15A motor.',
            location: 'Site B - Floor 2',
            name: 'Makita Circular Saw',
            serialNumber: 'MK-002',
            status: 'in_use',
        },
        {
            categoryId: powerToolsId,
            description: '11A corded reciprocating saw with vibration control.',
            location: 'Workshop',
            name: 'Bosch Reciprocating Saw',
            serialNumber: 'BS-003',
            status: 'maintenance',
        },
        {
            categoryId: powerToolsId,
            description: '18V brushless, 1/4 in. hex chuck.',
            location: 'Tool Crib A',
            name: 'Milwaukee Impact Driver',
            serialNumber: 'MW-004',
            status: 'available',
        },

        // Hand Tools
        {
            categoryId: handToolsId,
            description: 'Forged steel hammer with leather grip.',
            location: 'Tool Crib B',
            name: 'Estwing 22oz Framing Hammer',
            serialNumber: 'ES-010',
            status: 'available',
        },
        {
            categoryId: handToolsId,
            description: 'Mixed flat-head and Phillips drivers, cushion-grip.',
            location: 'Site A - Unit 3',
            name: 'Stanley 15-Piece Screwdriver Set',
            serialNumber: 'ST-011',
            status: 'in_use',
        },
        {
            categoryId: handToolsId,
            description:
                'Includes slip-joint, needle-nose, lineman, and diagonal pliers.',
            location: 'Tool Crib B',
            name: 'Channellock Plier Set (5-piece)',
            serialNumber: 'CL-012',
            status: 'available',
        },

        // Safety Equipment
        {
            categoryId: safetyId,
            description:
                'ANSI/ASSE Z359-compliant fall protection harness, size L.',
            location: 'Safety Cage',
            name: 'MSA Safety Harness - Full Body',
            serialNumber: 'MSA-020',
            status: 'available',
        },
        {
            categoryId: safetyId,
            description: 'Vented hard hat, ANSI Z89.1, yellow.',
            location: 'Site C',
            name: 'Honeywell Hard Hat (Type II)',
            serialNumber: 'HW-021',
            status: 'in_use',
        },
        {
            categoryId: safetyId,
            description:
                'P100 particulate respirator, medium, with replaceable cartridges.',
            location: 'Safety Cage',
            name: '3M Respirator Half-Face',
            serialNumber: '3M-022',
            status: 'available',
        },

        // Measurement
        {
            categoryId: measurementId,
            description:
                '330 ft range, bluetooth, ±1/16 in. accuracy. Handle with care.',
            location: 'Tool Crib A',
            name: 'Leica DISTO Laser Distance Meter',
            serialNumber: 'LD-030',
            status: 'available',
        },
        {
            categoryId: measurementId,
            description: 'Aluminium box-section levels, 0.5mm/m accuracy.',
            location: 'Site B - Floor 1',
            name: 'Stabila Level Set (24in + 48in)',
            serialNumber: 'SB-031',
            status: 'in_use',
        },

        // Electrical
        {
            categoryId: electricalId,
            description:
                'True-RMS, auto-ranging, non-contact voltage detection.',
            location: 'Electrical Room',
            name: 'Fluke 117 Multimeter',
            serialNumber: 'FL-040',
            status: 'available',
        },
        {
            categoryId: electricalId,
            description: 'Tone generator + probe for tracing wire runs.',
            location: 'Electrical Room',
            name: 'Klein Cable Tracer & Toner',
            serialNumber: 'KL-041',
            status: 'maintenance',
        },
    ])
    .returning()

console.log(`✓ Inserted ${String(items.length)} equipment items`)

// ── Summary ───────────────────────────────────────────────────────────────────
const statusCounts: Record<string, number> = {}
for (const item of items) {
    statusCounts[item.status] = (statusCounts[item.status] ?? 0) + 1
}

console.log('\nStatus breakdown:')
for (const [status, count] of Object.entries(statusCounts)) {
    const emoji =
        status === 'available'
            ? '🟢'
            : status === 'in_use'
              ? '🟡'
              : status === 'maintenance'
                ? '🔴'
                : '⚪'
    console.log(`  ${emoji}  ${status}: ${String(count)}`)
}

console.log(
    '\nDone! Run `pnpm exec drizzle-kit studio` to browse the data in your browser.',
)
