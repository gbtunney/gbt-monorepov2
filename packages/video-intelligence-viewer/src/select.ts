/**
 * Pure selectors that flatten the (possibly multi-entry) `annotation_results` array into the per-feature lists the
 * components render. Framework-free and safe to unit test.
 */

import {
    type LabelAnnotation,
    type PersonTrack,
    type ShotAnnotation,
    type VideoAnnotations,
} from './types.ts'
import { timeOffsetToSeconds } from './utils/time.ts'

/** Every person track across all annotation results. */
export const selectPersonTracks = (
    annotations: VideoAnnotations,
): Array<PersonTrack> =>
    annotations.annotation_results.flatMap((result) =>
        (result.person_detection_annotations ?? []).flatMap(
            (annotation) => annotation.tracks,
        ),
    )

/** Every shot across all annotation results. */
export const selectShots = (
    annotations: VideoAnnotations,
): Array<ShotAnnotation> =>
    annotations.annotation_results.flatMap(
        (result) => result.shot_annotations ?? [],
    )

/**
 * Label annotations, preferring shot-level labels and falling back to segment-level (matching the original visualiser's
 * label panel).
 */
export const selectLabels = (
    annotations: VideoAnnotations,
): Array<LabelAnnotation> =>
    annotations.annotation_results.flatMap(
        (result) =>
            result.shot_label_annotations ??
            result.segment_label_annotations ??
            [],
    )

/** One spoken segment: its best-alternative confidence and timed words. */
export type SpeechSegment = {
    confidence: number
    words: Array<SpeechWordTiming>
}

/** A transcribed word with its time range resolved to seconds. */
export type SpeechWordTiming = {
    end: number
    start: number
    text: string
}

/**
 * Speech transcriptions flattened to their best (first) alternative, with word `start_time`/`end_time` resolved to
 * seconds. Segments with no timed words are dropped.
 */
export const selectSpeech = (
    annotations: VideoAnnotations,
): Array<SpeechSegment> =>
    annotations.annotation_results
        .flatMap((result) => result.speech_transcriptions ?? [])
        .map((transcription) => {
            const alternative = transcription.alternatives[0]
            return {
                confidence: alternative?.confidence ?? 0,
                words: (alternative?.words ?? []).map((word) => ({
                    end: timeOffsetToSeconds(word.end_time),
                    start: timeOffsetToSeconds(word.start_time),
                    text: word.word,
                })),
            }
        })
        .filter((segment) => segment.words.length > 0)
