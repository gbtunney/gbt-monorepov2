/**
 * Pure helpers for explicit-content likelihood ratings. Framework-free so they run under the plain-node vitest `test`
 * target. Likelihood is categorical (a step function over time), so — unlike boxes — it is not interpolated.
 */

import { timeOffsetToSeconds } from './time.ts'
import { type ExplicitFrame } from '../types.ts'

/** The Video Intelligence likelihood enum, ordered least → most likely. */
export const LIKELIHOODS = [
    'LIKELIHOOD_UNSPECIFIED',
    'VERY_UNLIKELY',
    'UNLIKELY',
    'POSSIBLE',
    'LIKELY',
    'VERY_LIKELY',
] as const
export type Likelihood = (typeof LIKELIHOODS)[number]

const COLORS: Record<Likelihood, string> = {
    LIKELIHOOD_UNSPECIFIED: '#BDBDBD',
    LIKELY: '#FB8C00',
    POSSIBLE: '#FBBC05',
    UNLIKELY: '#9CCC65',
    VERY_LIKELY: '#EA4335',
    VERY_UNLIKELY: '#34A853',
}

const asLikelihood = (value?: string): Likelihood =>
    value !== undefined &&
    (LIKELIHOODS as ReadonlyArray<string>).includes(value)
        ? (value as Likelihood)
        : 'LIKELIHOOD_UNSPECIFIED'

/** Ordinal level (0–5) of a likelihood string; unknown/missing → 0. */
export const likelihoodLevel = (value?: string): number =>
    LIKELIHOODS.indexOf(asLikelihood(value))

/** Display color for a likelihood string (green = unlikely → red = very likely). */
export const likelihoodColor = (value?: string): string =>
    COLORS[asLikelihood(value)]

/**
 * The likelihood in effect at `seconds`: the most recent frame whose `time_offset` is at or before the time (a step
 * lookup). Returns `null` when there are no frames or the time precedes the first frame.
 */
export const likelihoodAtTime = (
    frames: Array<ExplicitFrame>,
    seconds: number,
): null | string => {
    let current: null | string = null
    for (const frame of frames) {
        if (timeOffsetToSeconds(frame.time_offset) > seconds) break
        current = frame.pornography_likelihood ?? 'LIKELIHOOD_UNSPECIFIED'
    }
    return current
}
