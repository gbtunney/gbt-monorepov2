import { describe, expect, it } from 'vitest'
import { selectShots, selectSpeech } from './select.ts'
import { type VideoAnnotations } from './types.ts'

const annotations: VideoAnnotations = {
    annotation_results: [
        {
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
        },
    ],
}

describe('selectShots', () => {
    it('flattens shots across results', () => {
        expect(selectShots(annotations)).toHaveLength(1)
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
