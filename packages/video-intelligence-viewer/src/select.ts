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
