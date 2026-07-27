import { describe, expect, it } from 'vitest'
import { likelihoodAtTime, likelihoodLevel } from './likelihood.ts'
import { type ExplicitFrame } from '../types.ts'

describe('likelihoodLevel', () => {
    it('orders least to most likely', () => {
        expect(likelihoodLevel('VERY_UNLIKELY')).toBe(1)
        expect(likelihoodLevel('POSSIBLE')).toBe(3)
        expect(likelihoodLevel('VERY_LIKELY')).toBe(5)
    })

    it('maps unknown or missing values to 0', () => {
        expect(likelihoodLevel()).toBe(0)
        expect(likelihoodLevel('NONSENSE')).toBe(0)
    })
})

const frames: Array<ExplicitFrame> = [
    { pornography_likelihood: 'VERY_UNLIKELY', time_offset: { seconds: 0 } },
    { pornography_likelihood: 'POSSIBLE', time_offset: { seconds: 2 } },
    { pornography_likelihood: 'LIKELY', time_offset: { seconds: 4 } },
]

describe('likelihoodAtTime', () => {
    it('returns null before the first frame', () => {
        expect(likelihoodAtTime(frames, -1)).toBeNull()
    })

    it('steps to the most recent frame at or before the time', () => {
        expect(likelihoodAtTime(frames, 0)).toBe('VERY_UNLIKELY')
        expect(likelihoodAtTime(frames, 3)).toBe('POSSIBLE')
        expect(likelihoodAtTime(frames, 10)).toBe('LIKELY')
    })
})
