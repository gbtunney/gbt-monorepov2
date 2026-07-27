import { describe, expect, it } from 'vitest'
import { parseAnnotations } from './parse.ts'

describe('parseAnnotations', () => {
    it('rejects invalid JSON', () => {
        expect(() => parseAnnotations('{ not json')).toThrow(/not valid json/i)
    })

    it('rejects payloads without annotation_results', () => {
        expect(() => parseAnnotations('{"foo": 1}')).toThrow(
            /annotation_results/i,
        )
    })

    it('parses a minimal valid payload', () => {
        const data = parseAnnotations(
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
        expect(data.annotation_results).toHaveLength(1)
        expect(data.annotation_results[0]?.shot_annotations).toHaveLength(1)
    })

    it('strips unknown feature keys but keeps known ones', () => {
        const data = parseAnnotations(
            JSON.stringify({
                annotation_results: [
                    {
                        explicit_annotation: { frames: [] },
                        shot_label_annotations: [
                            {
                                entity: { description: 'dog' },
                                segments: [{ confidence: 0.8 }],
                            },
                        ],
                    },
                ],
            }),
        )
        const result = data.annotation_results[0]
        expect(result.shot_label_annotations?.[0].entity.description).toBe(
            'dog',
        )
        expect(
            (result as Record<string, unknown>).explicit_annotation,
        ).toBeUndefined()
    })
})
