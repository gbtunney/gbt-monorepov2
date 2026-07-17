import type { Meta } from '@storybook/react'
import {
    defaultGbtScopeFlatViewerProps,
    type GbtScopeFlatViewerProps,
} from '../components/GbtScopeFlatViewer.tsx'
import {
    defaultGbtScopeMeshViewerProps,
    type GbtScopeMeshViewerProps,
} from '../components/GbtScopeMeshViewer.tsx'
import type {
    GbtScopeAnimator,
    GbtScopeAnimatorTarget,
    GbtScopeInputOverrides,
} from '../motion/animator.ts'
/* eslint  perfectionist/sort-objects: "off" */

/** Composed default args — single source of truth from the component defaults. */
export const flatDefaultArgs: GbtScopeFlatViewerProps = {
    ...defaultGbtScopeFlatViewerProps,
}

export const meshDefaultArgs: GbtScopeMeshViewerProps = {
    ...defaultGbtScopeMeshViewerProps,
}

/**
 * Flattened, slider-friendly motion controls for the Motion Playground stories. Each group maps to one animator;
 * setting a group's `speed` to 0 disables it. Composed into the real `animators` array at render time via
 * {@link buildPlaygroundAnimators}, so the sliders drive the running scene live.
 */
export type MotionPlaygroundArgs = {
    /** Constant time-driven rotation speed (radians/sec). 0 = off. */
    driftSpeed: number
    /** When true, the mock sliders below replace the real pointer/scroll inputs. */
    mockInputs: boolean
    /** Mocked pointer distance from canvas center (0 = center, ~1.4 = corner). */
    mockMouseDistance: number
    /** Mocked page scroll progress [0, 1]. */
    mockScrollProgress: number
    /** Mocked scroll-wheel velocity. */
    mockScrollVelocity: number
    mouseExponent: number
    mouseMax: number
    mouseMultiplier: number
    /** Pointer-distance influence speed. 0 = off. */
    mouseSpeed: number
    mouseTarget: GbtScopeAnimatorTarget
    scrollMax: number
    scrollMultiplier: number
    /** Scroll-wheel velocity influence speed. 0 = off. */
    scrollSpeed: number
    scrollTarget: GbtScopeAnimatorTarget
}

/** Default playground values — mirrors the preset stories' first-pass speeds. */
export const defaultMotionPlaygroundArgs = {
    driftSpeed: 0.3,
    mockInputs: false,
    mockMouseDistance: 0.5,
    mockScrollProgress: 0,
    mockScrollVelocity: 0,
    mouseExponent: 1.4,
    mouseMax: 1,
    mouseMultiplier: 0.6,
    mouseSpeed: 0,
    mouseTarget: 'rotation',
    scrollMax: 0.3,
    scrollMultiplier: 0.2,
    scrollSpeed: 0,
    scrollTarget: 'offset.x',
} satisfies MotionPlaygroundArgs

/**
 * Builds the viewer `inputOverrides` from the mock controls, or `undefined` when mocking is off (real pointer/scroll
 * drive the motion).
 */
export const buildPlaygroundInputOverrides = ({
    mockInputs = false,
    mockMouseDistance = 0,
    mockScrollProgress = 0,
    mockScrollVelocity = 0,
}: Partial<MotionPlaygroundArgs>): GbtScopeInputOverrides | undefined =>
    mockInputs
        ? {
              mouseDistance: mockMouseDistance,
              scrollProgress: mockScrollProgress,
              scrollVelocity: mockScrollVelocity,
          }
        : undefined

/** Composes the flattened playground args into a declarative `animators` array. Groups with speed 0 are skipped. */
export const buildPlaygroundAnimators = ({
    driftSpeed = 0,
    mouseExponent = 1,
    mouseMax = 1,
    mouseMultiplier = 1,
    mouseSpeed = 0,
    mouseTarget = 'rotation',
    scrollMax = 1,
    scrollMultiplier = 1,
    scrollSpeed = 0,
    scrollTarget = 'offset.x',
}: Partial<MotionPlaygroundArgs>): Array<GbtScopeAnimator> => {
    const animators: Array<GbtScopeAnimator> = []
    if (driftSpeed !== 0)
        animators.push({
            mode: 'add',
            source: 'time',
            speed: driftSpeed,
            target: 'rotation',
        })
    if (mouseSpeed !== 0)
        animators.push({
            curve: {
                exponent: mouseExponent,
                max: mouseMax,
                multiplier: mouseMultiplier,
            },
            mode: 'add',
            source: 'mouseDistance',
            speed: mouseSpeed,
            target: mouseTarget,
        })
    if (scrollSpeed !== 0)
        animators.push({
            curve: { max: scrollMax, multiplier: scrollMultiplier },
            mode: 'add',
            source: 'scrollVelocity',
            speed: scrollSpeed,
            target: scrollTarget,
        })
    return animators
}

const animatorTargetOptions: Array<GbtScopeAnimatorTarget> = [
    'rotation',
    'offset.x',
    'offset.y',
    'scaleFactor',
    'opacity',
]

/**
 * Controls for {@link MotionPlaygroundArgs}; also hides the derived raw `animators`/`inputOverrides` controls. Speeds
 * are number inputs (exact entry, 0 = off); curve shapes are sliders; mock inputs live in their own category.
 */
export const motionPlaygroundArgTypes: Meta['argTypes'] = {
    animators: { table: { disable: true } },
    inputOverrides: { table: { disable: true } },
    driftSpeed: {
        control: { step: 0.01, type: 'number' },
        description: 'Constant rotation drift (rad/sec). 0 = off.',
        table: { category: 'Motion Playground' },
    },
    mouseSpeed: {
        control: { step: 0.01, type: 'number' },
        description: 'Pointer-distance influence. 0 = off.',
        table: { category: 'Motion Playground' },
    },
    mouseTarget: {
        control: { type: 'select' },
        options: animatorTargetOptions,
        table: { category: 'Motion Playground' },
    },
    mouseMultiplier: {
        control: { max: 2, min: 0, step: 0.05, type: 'range' },
        description: 'Curve gain applied before the exponent.',
        table: { category: 'Motion Playground' },
    },
    mouseExponent: {
        control: { max: 4, min: 0.1, step: 0.1, type: 'range' },
        description: 'Curve shaping (1 = linear, >1 = ease-in).',
        table: { category: 'Motion Playground' },
    },
    mouseMax: {
        control: { max: 2, min: 0, step: 0.05, type: 'range' },
        description: 'Upper clamp on the curved value.',
        table: { category: 'Motion Playground' },
    },
    scrollSpeed: {
        control: { step: 0.01, type: 'number' },
        description: 'Scroll-wheel velocity influence. 0 = off.',
        table: { category: 'Motion Playground' },
    },
    scrollTarget: {
        control: { type: 'select' },
        options: animatorTargetOptions,
        table: { category: 'Motion Playground' },
    },
    scrollMultiplier: {
        control: { max: 2, min: 0, step: 0.05, type: 'range' },
        description: 'Curve gain applied before the exponent.',
        table: { category: 'Motion Playground' },
    },
    scrollMax: {
        control: { max: 2, min: 0, step: 0.05, type: 'range' },
        description: 'Upper clamp on the curved value.',
        table: { category: 'Motion Playground' },
    },
    mockInputs: {
        control: { type: 'boolean' },
        description:
            'Replace real pointer/scroll input with the mock sliders below — device-independent testing with exact values.',
        table: { category: 'Mock Inputs' },
    },
    mockMouseDistance: {
        control: { max: 1.5, min: 0, step: 0.01, type: 'range' },
        description:
            'Mocked pointer distance from center (0 = center, ~1.4 = corner).',
        table: { category: 'Mock Inputs' },
    },
    mockScrollProgress: {
        control: { max: 1, min: 0, step: 0.01, type: 'range' },
        description: 'Mocked page scroll progress.',
        table: { category: 'Mock Inputs' },
    },
    mockScrollVelocity: {
        control: { max: 2, min: -2, step: 0.01, type: 'range' },
        description: 'Mocked scroll-wheel velocity.',
        table: { category: 'Mock Inputs' },
    },
}

export const argTypes: Meta['argTypes'] = {
    //  Motion — declarative animators
    animators: {
        control: { type: 'object' },
        description:
            'Declarative motion rules: { target, source, mode, speed, curve }[]',
        table: { category: 'Motion' },
    },
    aspect_ratio: {
        control: { type: 'select' },
        options: {
            // @ts-expect-error: storybook option map values
            '1:1': 1,
            '1:2': 0.5,
            '3:2': 1.5,
            '4:3': 1.33333333,
            '16:9': 1.7777778,
        },
        table: { category: 'General Settings' },
    },

    bg_color: { control: 'color' },
    imageAspect: {
        control: { max: 4, min: 0.01, step: 0.1, type: 'number' },
        description: 'Src image aspect ratio',
        table: { category: 'General Settings' },
    },
    offset: {
        control: { type: 'object' },
        table: { category: 'Transform' },
    },

    offsetScale: {
        control: { max: 4, min: 0.001, step: 0.01, type: 'number' },
        table: { category: 'Transform' },
    },
    opacity: {
        control: { max: 1, min: 0, step: 0.01, type: 'number' },
        table: { category: 'Graphic Settings' },
    },
    resolution: { control: 'object' },
    //  Rotation / Offset base values
    rotation: {
        control: { max: 360, min: 0, step: 0.1, type: 'number' },
        table: { category: 'Transform' },
    },
    rotationScale: {
        control: { max: 4, min: 0.001, step: 0.001, type: 'number' },
        table: { category: 'Transform' },
    },

    scaleFactor: {
        control: { max: 3, min: 0.01, step: 0.1, type: 'number' },
        table: { category: 'Graphic Settings' },
    },
    segments: {
        control: { max: 30, min: 1, step: 1, type: 'number' },
        table: { category: 'Graphic Settings' },
    },
    //  General Settings
    src: {
        control: { type: 'select' },
        options: ['uv-checker.png', 'gradient4-3.png', 'eel.jpg'],
        table: { category: 'General Settings' },
    },
    tileMode: {
        control: { type: 'select' },
        description: 'Tiling strategy applied after the radial fold',
        options: ['none', 'repeat', 'mirror'],
        table: { category: 'Graphic Settings' },
    },

    //  Graphic Settings
    tiling: {
        control: { max: 20, min: 1, step: 1, type: 'number' },
        table: { category: 'Graphic Settings' },
    },
}
