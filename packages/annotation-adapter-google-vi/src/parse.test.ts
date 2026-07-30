import { describe, expect, it } from 'vitest'

import { parseGoogleVi } from './parse.ts'

describe('parseGoogleVi', () => {
    it('parses a valid snake_case payload from a string', () => {
        const result = parseGoogleVi(
            JSON.stringify({
                annotation_results: [
                    {
                        shot_annotations: [
                            { start_time_offset: { seconds: 0 } },
                        ],
                    },
                ],
            }),
        )
        expect(result.annotation_results).toHaveLength(1)
    })

    it('accepts an already-parsed object', () => {
        const result = parseGoogleVi({ annotation_results: [] })
        expect(result.annotation_results).toStrictEqual([])
    })

    it('throws a friendly error on invalid JSON', () => {
        expect(() => parseGoogleVi('{ not json')).toThrow(/Not valid JSON/)
    })

    it('throws when annotation_results is missing', () => {
        expect(() => parseGoogleVi({ results: [] })).toThrow(
            /Missing "annotation_results"/,
        )
    })
})
