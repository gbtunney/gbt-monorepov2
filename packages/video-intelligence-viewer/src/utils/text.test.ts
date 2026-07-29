import { describe, expect, it } from 'vitest'
import { polygonAtTime } from './text.ts'
import { type TextFrame } from '../types.ts'

const frames: Array<TextFrame> = [
    {
        rotated_bounding_box: {
            vertices: [
                { x: 0, y: 0 },
                { x: 0.2, y: 0 },
                { x: 0.2, y: 0.1 },
                { x: 0, y: 0.1 },
            ],
        },
        time_offset: { seconds: 0 },
    },
    {
        rotated_bounding_box: {
            vertices: [
                { x: 0.4, y: 0.4 },
                { x: 0.6, y: 0.4 },
                { x: 0.6, y: 0.5 },
                { x: 0.4, y: 0.5 },
            ],
        },
        time_offset: { seconds: 2 },
    },
]

describe('polygonAtTime', () => {
    it('returns null with no frames', () => {
        expect(polygonAtTime([], 1)).toBeNull()
    })

    it('returns the first frame vertices at the start', () => {
        expect(polygonAtTime(frames, 0)).toEqual([
            { x: 0, y: 0 },
            { x: 0.2, y: 0 },
            { x: 0.2, y: 0.1 },
            { x: 0, y: 0.1 },
        ])
    })

    it('interpolates vertices halfway between frames', () => {
        const polygon = polygonAtTime(frames, 1)
        expect(polygon?.[0].x).toBeCloseTo(0.2)
        expect(polygon?.[0].y).toBeCloseTo(0.2)
        expect(polygon?.[2].x).toBeCloseTo(0.4)
    })
})
