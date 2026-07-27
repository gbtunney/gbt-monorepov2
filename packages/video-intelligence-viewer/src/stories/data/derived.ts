/**
 * Per-component props derived once from {@link sampleAnnotations}, so the inner-component stories stay DRY and share the
 * exact data the viewer renders.
 */

import { sampleAnnotations } from './sample-annotations.ts'
import {
    selectExplicitFrames,
    selectLabels,
    selectObjectTracks,
    selectShots,
    selectSpeech,
    selectText,
} from '../../select.ts'

/** The sample clip is ~10s (see `sample-annotations.ts`). */
export const SAMPLE_VIDEO_LENGTH = 10

export const SAMPLE_SHOTS = selectShots(sampleAnnotations)
export const SAMPLE_LABELS = selectLabels(sampleAnnotations)
export const SAMPLE_SPEECH = selectSpeech(sampleAnnotations)
export const SAMPLE_OBJECTS = selectObjectTracks(sampleAnnotations)
export const SAMPLE_TEXTS = selectText(sampleAnnotations)
export const SAMPLE_EXPLICIT = selectExplicitFrames(sampleAnnotations)
