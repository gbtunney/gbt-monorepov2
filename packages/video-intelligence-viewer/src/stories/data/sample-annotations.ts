/**
 * A small, hand-built snake_case sample payload so the Storybook demo renders shots, labels, and a moving person box
 * without any upload. Swap in real Video Intelligence API output via the "Load annotations" button. Assumes a ~10s
 * clip.
 */

import { type VideoAnnotations } from '../../types.ts'

export const sampleAnnotations: VideoAnnotations = {
    annotation_results: [
        {
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
        },
    ],
}
