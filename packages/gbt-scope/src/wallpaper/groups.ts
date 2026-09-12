export const wallpaperGroups = [
    'p1',
    'p2',
    'pm',
    'pg',
    'cm',
    'pmm',
    'pmg',
    'pgg',
    'cmm',
    'p4',
    'p4m',
    'p4g',
    'p3',
    'p3m1',
    'p31m',
    'p6',
    'p6m',
] as const

export type GbtScopeWallpaperGroup = (typeof wallpaperGroups)[number]

export type GbtScopeWallpaperGroupFamily =
    | 'rectangular'
    | 'square'
    | 'triangular'

export type GbtScopeWallpaperGroupDefinition = {
    description: string
    family: GbtScopeWallpaperGroupFamily
    group: GbtScopeWallpaperGroup
    id: number
    name: string
}

export const wallpaperGroupDefinitions = [
    {
        description: 'Translation only.',
        family: 'rectangular',
        group: 'p1',
        id: 0,
        name: 'Translation',
    },
    {
        description: 'Translation with half-turn rotation.',
        family: 'rectangular',
        group: 'p2',
        id: 1,
        name: 'Half-turn',
    },
    {
        description: 'Parallel mirror axes.',
        family: 'rectangular',
        group: 'pm',
        id: 2,
        name: 'Mirror',
    },
    {
        description: 'Parallel glide reflections.',
        family: 'rectangular',
        group: 'pg',
        id: 3,
        name: 'Glide reflection',
    },
    {
        description: 'Centered lattice with reflection.',
        family: 'rectangular',
        group: 'cm',
        id: 4,
        name: 'Centered mirror',
    },
    {
        description: 'Perpendicular mirror axes.',
        family: 'rectangular',
        group: 'pmm',
        id: 5,
        name: 'Double mirror',
    },
    {
        description: 'Mirrors combined with perpendicular glides.',
        family: 'rectangular',
        group: 'pmg',
        id: 6,
        name: 'Mirror + glide',
    },
    {
        description: 'Two perpendicular glide-reflection systems.',
        family: 'rectangular',
        group: 'pgg',
        id: 7,
        name: 'Double glide',
    },
    {
        description: 'Centered lattice with perpendicular mirrors.',
        family: 'rectangular',
        group: 'cmm',
        id: 8,
        name: 'Centered double mirror',
    },
    {
        description: 'Quarter-turn rotation on a square lattice.',
        family: 'square',
        group: 'p4',
        id: 9,
        name: 'Quarter-turn',
    },
    {
        description: 'Quarter-turn rotation with diagonal mirrors.',
        family: 'square',
        group: 'p4m',
        id: 10,
        name: 'Square kaleidoscope',
    },
    {
        description: 'Quarter-turn rotation with glide reflections.',
        family: 'square',
        group: 'p4g',
        id: 11,
        name: 'Quarter-turn glide',
    },
    {
        description: 'Three-fold rotation on a triangular lattice.',
        family: 'triangular',
        group: 'p3',
        id: 12,
        name: 'Three-fold',
    },
    {
        description: 'Three-fold rotation with one mirror arrangement.',
        family: 'triangular',
        group: 'p3m1',
        id: 13,
        name: 'Three-fold mirror 1',
    },
    {
        description: 'Three-fold rotation with the alternate mirrors.',
        family: 'triangular',
        group: 'p31m',
        id: 14,
        name: 'Three-fold mirror 2',
    },
    {
        description: 'Six-fold rotation on a hexagonal lattice.',
        family: 'triangular',
        group: 'p6',
        id: 15,
        name: 'Six-fold',
    },
    {
        description: 'Six-fold rotation with mirror axes.',
        family: 'triangular',
        group: 'p6m',
        id: 16,
        name: 'Hexagonal kaleidoscope',
    },
] as const satisfies ReadonlyArray<GbtScopeWallpaperGroupDefinition>

export const wallpaperGroupToFloat = (
    group: GbtScopeWallpaperGroup,
): number =>
    wallpaperGroupDefinitions.find((definition) => definition.group === group)
        ?.id ?? 0
