import { describe, expect, it } from 'vitest'
import {
    selectObjectTracks,
    selectShots,
    selectSpeech,
    selectText,
} from './select.ts'
import { type VideoAnnotations } from './types.ts'

const annotations: VideoAnnotations = {
    annotation_results: [
        {
            object_annotations: [
                {
                    confidence: 0.8,
                    entity: { description: 'car' },
                    frames: [
                        {
                            normalized_bounding_box: { left: 0.1, top: 0.1 },
                            time_offset: { seconds: 0 },
                        },
                    ],
                },
            ],
            shot_annotations: [
                {
                    end_time_offset: { seconds: 3 },
                    start_time_offset: { seconds: 0 },
                },
            ],
            speech_transcriptions: [
                {
                    alternatives: [
                        {
                            confidence: 0.9,
                            transcript: 'hello world',
                            words: [
                                {
                                    end_time: { nanos: 500_000_000 },
                                    start_time: { seconds: 0 },
                                    word: 'hello',
                                },
                                {
                                    end_time: { seconds: 1 },
                                    start_time: { nanos: 500_000_000 },
                                    word: 'world',
                                },
                            ],
                        },
                    ],
                },
                { alternatives: [] },
            ],
            text_annotations: [
                {
                    segments: [
                        {
                            confidence: 0.7,
                            frames: [
                                {
                                    rotated_bounding_box: {
                                        vertices: [{ x: 0, y: 0 }],
                                    },
                                    time_offset: { seconds: 0 },
                                },
                            ],
                        },
                    ],
                    text: 'STOP',
                },
            ],
        },
    ],
}

describe('selectShots', () => {
    it('flattens shots across results', () => {
        expect(selectShots(annotations)).toHaveLength(1)
    })
})

describe('selectObjectTracks', () => {
    it('flattens object annotations', () => {
        const objects = selectObjectTracks(annotations)
        expect(objects).toHaveLength(1)
        expect(objects[0]?.entity.description).toBe('car')
    })
})

describe('selectText', () => {
    it('flattens text annotations', () => {
        const texts = selectText(annotations)
        expect(texts).toHaveLength(1)
        expect(texts[0]?.text).toBe('STOP')
    })
})

describe('selectSpeech', () => {
    it('resolves the best alternative words to seconds', () => {
        const segments = selectSpeech(annotations)
        expect(segments).toHaveLength(1)
        expect(segments[0]?.confidence).toBe(0.9)
        expect(segments[0]?.words).toEqual([
            { end: 0.5, start: 0, text: 'hello' },
            { end: 1, start: 0.5, text: 'world' },
        ])
    })

    it('drops segments with no timed words', () => {
        expect(
            selectSpeech({
                annotation_results: [{ speech_transcriptions: [] }],
            }),
        ).toHaveLength(0)
    })
})
