import { describe, expect, test } from 'vitest'
import {
    wallpaperGroupDefinitions,
    wallpaperGroups,
    wallpaperGroupToFloat,
} from './groups.ts'

describe('wallpaper group registry', () => {
    test('contains all 17 crystallographic wallpaper groups', () => {
        expect(wallpaperGroups).toHaveLength(17)
        expect(new Set(wallpaperGroups).size).toBe(17)
        expect(wallpaperGroupDefinitions).toHaveLength(17)
    })

    test('maps every group to a stable unique shader id', () => {
        const ids = wallpaperGroups.map(wallpaperGroupToFloat)
        expect(ids).toEqual([...Array(17).keys()])
        expect(new Set(ids).size).toBe(17)
    })
})
