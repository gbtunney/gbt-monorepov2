import { annotationSchema } from '@snailicid3/annotation-core'
import { describe, expect, it } from 'vitest'

import { adaptGoogleVideoIntelligence } from './adapter.ts'
import { type VideoAnnotations } from './google-vi-schema.ts'

/** A compact snake_case payload exercising every feature the adapter normalises. Assumes a ~10s clip. */
const fixture: VideoAnnotations = {
    annotation_results: [
        {
            explicit_annotation: {
                frames: [
                    {
                        pornography_likelihood: 'VERY_UNLIKELY',
                        time_offset: { seconds: 0 },
                    },
                    {
                        pornography_likelihood: 'POSSIBLE',
                        time_offset: { seconds: 5 },
                    },
                ],
            },
            object_annotations: [
                {
                    confidence: 0.81,
                    entity: { description: 'car' },
                    frames: [
                        {
                            normalized_bounding_box: {
                                bottom: 0.7,
                                left: 0.05,
                                right: 0.3,
                                top: 0.5,
                            },
                            time_offset: { seconds: 2 },
                        },
                    ],
                    segment: {
                        end_time_offset: { seconds: 6 },
                        start_time_offset: { seconds: 2 },
                    },
                },
                {
                    confidence: 0.6,
                    entity: { description: 'car' },
                    frames: [
                        {
                            normalized_bounding_box: {
                                bottom: 0.7,
                                left: 0.5,
                                right: 0.7,
                                top: 0.5,
                            },
                            time_offset: { seconds: 7 },
                        },
                    ],
                    segment: {
                        end_time_offset: { seconds: 9 },
                        start_time_offset: { seconds: 7 },
                    },
                },
            ],
            person_detection_annotations: [
                {
                    tracks: [
                        {
                            confidence: 0.92,
                            segment: {
                                end_time_offset: { seconds: 9 },
                                start_time_offset: { seconds: 1 },
                            },
                            timestamped_objects: [
                                {
                                    landmarks: [
                                        {
                                            name: 'nose',
                                            point: { x: 0.15, y: 0.3 },
                                        },
                                    ],
                                    normalized_bounding_box: {
                                        bottom: 0.8,
                                        left: 0.1,
                                        right: 0.3,
                                        top: 0.25,
                                    },
                                    time_offset: { seconds: 1 },
                                },
                            ],
                        },
                    ],
                },
            ],
            segment_label_annotations: [
                {
                    entity: { description: 'bread' },
                    segments: [
                        {
                            confidence: 0.7,
                            segment: {
                                end_time_offset: { seconds: 10 },
                                start_time_offset: { seconds: 0 },
                            },
                        },
                    ],
                },
            ],
            shot_annotations: [
                {
                    end_time_offset: { nanos: 500_000_000, seconds: 3 },
                    start_time_offset: { seconds: 0 },
                },
                {
                    end_time_offset: { seconds: 7 },
                    start_time_offset: { nanos: 500_000_000, seconds: 3 },
                },
                {
                    end_time_offset: { seconds: 10 },
                    start_time_offset: { seconds: 7 },
                },
            ],
            shot_label_annotations: [
                {
                    entity: { description: 'bread' },
                    segments: [
                        {
                            confidence: 0.9,
                            segment: {
                                end_time_offset: { seconds: 5 },
                                start_time_offset: { seconds: 0 },
                            },
                        },
                    ],
                },
                {
                    category_entities: [{ description: 'food' }],
                    entity: { description: 'bakery' },
                    segments: [
                        {
                            confidence: 0.8,
                            segment: {
                                end_time_offset: { seconds: 8 },
                                start_time_offset: { seconds: 2 },
                            },
                        },
                    ],
                },
            ],
            speech_transcriptions: [
                {
                    alternatives: [
                        {
                            confidence: 0.94,
                            transcript: 'hello world',
                            words: [
                                {
                                    end_time: {
                                        nanos: 500_000_000,
                                        seconds: 1,
                                    },
                                    start_time: { seconds: 1 },
                                    word: 'hello',
                                },
                                {
                                    end_time: { seconds: 2 },
                                    start_time: {
                                        nanos: 500_000_000,
                                        seconds: 1,
                                    },
                                    word: 'world',
                                },
                            ],
                        },
                    ],
                },
            ],
            text_annotations: [
                {
                    segments: [
                        {
                            confidence: 0.79,
                            frames: [
                                {
                                    rotated_bounding_box: {
                                        vertices: [
                                            { x: 0.6, y: 0.1 },
                                            { x: 0.9, y: 0.12 },
                                        ],
                                    },
                                    time_offset: { seconds: 1 },
                                },
                            ],
                            segment: {
                                end_time_offset: { seconds: 8 },
                                start_time_offset: { seconds: 1 },
                            },
                        },
                    ],
                    text: 'BAKERY',
                },
            ],
        },
    ],
}

const options = { createdAt: '2026-01-01T00:00:00.000Z', mediaId: 'media-1' }

const adapt = () => adaptGoogleVideoIntelligence(fixture, options)

const countBy = (
    annotations: ReturnType<typeof adapt>['annotations'],
): Record<string, number> =>
    annotations.reduce<Record<string, number>>((counts, annotation) => {
        counts[annotation.kind] = (counts[annotation.kind] ?? 0) + 1
        return counts
    }, {})

describe('adaptGoogleVideoIntelligence', () => {
    it('normalises every feature into the expected kind counts', () => {
        const { annotations } = adapt()
        expect(countBy(annotations)).toStrictEqual({
            explicit: 2,
            label: 3,
            object: 2,
            person: 1,
            shot: 3,
            text: 1,
            transcript: 1,
        })
    })

    it('synthesises an analysis run and stamps every annotation with it', () => {
        const { analysisRun, annotations } = adapt()
        expect(analysisRun).toStrictEqual({
            createdAt: '2026-01-01T00:00:00.000Z',
            id: 'media-1:google-vi',
            mediaId: 'media-1',
            provider: 'google-video-intelligence',
            status: 'complete',
        })
        expect(
            annotations.every(
                (annotation) =>
                    annotation.origin === 'machine' &&
                    annotation.mediaId === 'media-1' &&
                    annotation.analysisRunId === 'media-1:google-vi',
            ),
        ).toBe(true)
    })

    it('dedupes labels by name — occurrences of one label share a trackId', () => {
        const bread = adapt().annotations.filter(
            (annotation) =>
                annotation.kind === 'label' && annotation.label === 'bread',
        )
        expect(bread).toHaveLength(2)
        expect(
            new Set(bread.map((annotation) => annotation.trackId)),
        ).toStrictEqual(new Set(['label:bread']))
    })

    it('does NOT dedupe objects — same description, distinct tracks', () => {
        const cars = adapt().annotations.filter(
            (annotation) => annotation.kind === 'object',
        )
        expect(cars).toHaveLength(2)
        expect(new Set(cars.map((annotation) => annotation.trackId)).size).toBe(
            2,
        )
    })

    it('maps explicit-content frames to point targets', () => {
        const explicit = adapt().annotations.filter(
            (annotation) => annotation.kind === 'explicit',
        )
        expect(explicit.map((annotation) => annotation.temporal)).toStrictEqual(
            [
                { at: 0, kind: 'point' },
                { at: 5, kind: 'point' },
            ],
        )
    })

    it('resolves interval ranges from segments and word timings', () => {
        const { annotations } = adapt()
        const bakery = annotations.find(
            (annotation) => annotation.label === 'bakery',
        )
        const transcript = annotations.find(
            (annotation) => annotation.kind === 'transcript',
        )
        const firstShot = annotations.find(
            (annotation) => annotation.id === 'g:0:shot:0',
        )
        expect(bakery?.temporal).toStrictEqual({
            end: 8,
            kind: 'interval',
            start: 2,
        })
        expect(transcript?.temporal).toStrictEqual({
            end: 2,
            kind: 'interval',
            start: 1,
        })
        expect(firstShot?.temporal).toStrictEqual({
            end: 3.5,
            kind: 'interval',
            start: 0,
        })
    })

    it('preserves the raw Google sub-object on each annotation', () => {
        const car = adapt().annotations.find(
            (annotation) => annotation.kind === 'object',
        )
        expect(
            (car?.raw as { entity: { description: string } }).entity
                .description,
        ).toBe('car')
    })

    it('produces annotations that validate against annotation-core schema', () => {
        for (const annotation of adapt().annotations) {
            expect(() => annotationSchema.parse(annotation)).not.toThrow()
        }
    })
})
