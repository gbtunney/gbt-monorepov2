import { describe, expect, it } from 'vitest'

import {
    annotationsAt,
    annotationsWithin,
    byConfidence,
    byText,
    countsByKind,
    groupByTrack,
    queryAnnotations,
} from './query.ts'
import { type Annotation } from './types.ts'

const annotation = (
    overrides: Partial<Annotation> & Pick<Annotation, 'id'>,
): Annotation => ({
    kind: 'label',
    label: 'thing',
    mediaId: 'media-1',
    origin: 'machine',
    temporal: { end: 10, kind: 'interval', start: 0 },
    ...overrides,
})

const fixtures: Array<Annotation> = [
    annotation({ confidence: 0.9, id: 'bakery', label: 'bakery' }),
    annotation({ confidence: 0.4, id: 'bread', label: 'bread' }),
    annotation({
        confidence: 0.95,
        id: 'person',
        kind: 'object',
        label: 'person',
        temporal: { at: 5, kind: 'point' },
        trackId: 'track-1',
    }),
    annotation({
        id: 'note',
        kind: 'comment',
        label: 'my note',
        origin: 'human',
        temporal: { end: 8, kind: 'interval', start: 4 },
    }),
    annotation({
        confidence: 0.99,
        id: 'car',
        label: 'car',
        temporal: { end: 60, kind: 'interval', start: 50 },
    }),
]

const ids = (items: Array<Annotation>): Array<string> =>
    items.map((item) => item.id)

describe('annotationsAt', () => {
    it('returns everything covering the playhead', () => {
        expect(ids(annotationsAt(fixtures, 5))).toStrictEqual([
            'bakery',
            'bread',
            'person',
            'note',
        ])
    })

    it('returns nothing in a gap', () => {
        expect(annotationsAt(fixtures, 30)).toStrictEqual([])
    })
})

describe('annotationsWithin', () => {
    it('excludes annotations outside the selection', () => {
        expect(ids(annotationsWithin(fixtures, 0, 10))).not.toContain('car')
    })

    it('includes annotations that only partially overlap', () => {
        expect(ids(annotationsWithin(fixtures, 55, 70))).toStrictEqual(['car'])
    })
})

describe('byConfidence', () => {
    it('drops machine annotations below the floor', () => {
        expect(ids(byConfidence(fixtures, 0.5))).not.toContain('bread')
    })

    it('keeps annotations that carry no confidence at all', () => {
        expect(ids(byConfidence(fixtures, 0.5))).toContain('note')
    })
})

describe('byText', () => {
    it('matches case-insensitively', () => {
        expect(ids(byText(fixtures, 'BREAD'))).toStrictEqual(['bread'])
    })

    it('returns everything for an empty query', () => {
        expect(byText(fixtures, '   ')).toHaveLength(fixtures.length)
    })
})

describe('countsByKind', () => {
    it('tallies each kind', () => {
        expect(countsByKind(fixtures)).toStrictEqual({
            comment: 1,
            label: 3,
            object: 1,
        })
    })
})

describe('groupByTrack', () => {
    it('collects untracked annotations under null', () => {
        const tracks = groupByTrack(fixtures)

        expect(tracks.get('track-1')).toHaveLength(1)
        expect(tracks.get(null)).toHaveLength(4)
    })
})

describe('queryAnnotations', () => {
    it('returns everything when unfiltered', () => {
        expect(queryAnnotations(fixtures).items).toHaveLength(fixtures.length)
    })

    it('prefers an explicit range over a playhead position', () => {
        const result = queryAnnotations(fixtures, { at: 5, range: [50, 60] })

        expect(ids(result.items)).toStrictEqual(['car'])
    })

    it('reports counts for hidden kinds so their badges still show a number', () => {
        const result = queryAnnotations(fixtures, { kinds: ['label'] })

        expect(result.counts['object']).toBe(1)
        expect(result.counts['comment']).toBe(1)
        expect(result.items.every((item) => item.kind === 'label')).toBe(true)
    })

    it('scopes counts to the current range', () => {
        const result = queryAnnotations(fixtures, { range: [0, 10] })

        expect(result.counts['label']).toBe(2)
    })

    it('composes range, confidence, and text filters', () => {
        const result = queryAnnotations(fixtures, {
            confidenceMin: 0.5,
            range: [0, 10],
            text: 'a',
        })

        expect(ids(result.items)).toStrictEqual(['bakery'])
    })
})
