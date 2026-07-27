/**
 * A small, hand-built snake_case sample payload so the Storybook demo renders shots, labels, and a moving person box
 * without any upload. Swap in real Video Intelligence API output via the "Load annotations" button. Assumes a ~10s
 * clip.
 */

import { type VideoAnnotations } from '../../types.ts'

export const sampleAnnotations: VideoAnnotations = {
    annotation_results: [
        {
            explicit_annotation: {
                frames: [
                    {
                        pornography_likelihood: 'VERY_UNLIKELY',
                        time_offset: { seconds: 0 },
                    },
                    {
                        pornography_likelihood: 'UNLIKELY',
                        time_offset: { seconds: 3 },
                    },
                    {
                        pornography_likelihood: 'POSSIBLE',
                        time_offset: { seconds: 5 },
                    },
                    {
                        pornography_likelihood: 'VERY_UNLIKELY',
                        time_offset: { seconds: 7 },
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
                        {
                            normalized_bounding_box: {
                                bottom: 0.7,
                                left: 0.4,
                                right: 0.65,
                                top: 0.5,
                            },
                            time_offset: { seconds: 6 },
                        },
                    ],
                    segment: {
                        end_time_offset: { seconds: 6 },
                        start_time_offset: { seconds: 2 },
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
                                {
                                    landmarks: [
                                        {
                                            name: 'nose',
                                            point: { x: 0.55, y: 0.28 },
                                        },
                                    ],
                                    normalized_bounding_box: {
                                        bottom: 0.82,
                                        left: 0.5,
                                        right: 0.7,
                                        top: 0.22,
                                    },
                                    time_offset: { seconds: 5 },
                                },
                                {
                                    landmarks: [
                                        {
                                            name: 'nose',
                                            point: { x: 0.8, y: 0.3 },
                                        },
                                    ],
                                    normalized_bounding_box: {
                                        bottom: 0.8,
                                        left: 0.72,
                                        right: 0.92,
                                        top: 0.25,
                                    },
                                    time_offset: {
                                        nanos: 500_000_000,
                                        seconds: 8,
                                    },
                                },
                            ],
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
                    entity: { description: 'person' },
                    segments: [
                        {
                            confidence: 0.88,
                            segment: {
                                end_time_offset: { seconds: 9 },
                                start_time_offset: { seconds: 1 },
                            },
                        },
                    ],
                },
                {
                    category_entities: [{ description: 'outdoor' }],
                    entity: { description: 'walking' },
                    segments: [
                        {
                            confidence: 0.72,
                            segment: {
                                end_time_offset: { seconds: 7 },
                                start_time_offset: {
                                    nanos: 500_000_000,
                                    seconds: 3,
                                },
                            },
                        },
                    ],
                },
                {
                    entity: { description: 'sky' },
                    segments: [
                        {
                            confidence: 0.34,
                            segment: {
                                end_time_offset: { seconds: 10 },
                                start_time_offset: { seconds: 0 },
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
                            transcript: 'the quick brown fox jumps over',
                            words: [
                                {
                                    end_time: {
                                        nanos: 500_000_000,
                                        seconds: 1,
                                    },
                                    start_time: { seconds: 1 },
                                    word: 'the',
                                },
                                {
                                    end_time: {
                                        nanos: 200_000_000,
                                        seconds: 2,
                                    },
                                    start_time: {
                                        nanos: 500_000_000,
                                        seconds: 1,
                                    },
                                    word: 'quick',
                                },
                                {
                                    end_time: { seconds: 3 },
                                    start_time: {
                                        nanos: 200_000_000,
                                        seconds: 2,
                                    },
                                    word: 'brown',
                                },
                                {
                                    end_time: {
                                        nanos: 800_000_000,
                                        seconds: 3,
                                    },
                                    start_time: { seconds: 3 },
                                    word: 'fox',
                                },
                                {
                                    end_time: {
                                        nanos: 600_000_000,
                                        seconds: 4,
                                    },
                                    start_time: { seconds: 4 },
                                    word: 'jumps',
                                },
                                {
                                    end_time: {
                                        nanos: 200_000_000,
                                        seconds: 5,
                                    },
                                    start_time: {
                                        nanos: 600_000_000,
                                        seconds: 4,
                                    },
                                    word: 'over',
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
                                            { x: 0.9, y: 0.2 },
                                            { x: 0.6, y: 0.18 },
                                        ],
                                    },
                                    time_offset: { seconds: 1 },
                                },
                                {
                                    rotated_bounding_box: {
                                        vertices: [
                                            { x: 0.6, y: 0.1 },
                                            { x: 0.9, y: 0.12 },
                                            { x: 0.9, y: 0.2 },
                                            { x: 0.6, y: 0.18 },
                                        ],
                                    },
                                    time_offset: { seconds: 8 },
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
