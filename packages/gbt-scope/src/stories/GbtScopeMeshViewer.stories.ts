import type { Meta, StoryObj } from '@storybook/react'
import { createElement, type ReactElement } from 'react'
import {
    argTypes,
    buildPlaygroundAnimators,
    defaultMotionPlaygroundArgs,
    meshDefaultArgs,
    type MotionPlaygroundArgs,
    motionPlaygroundArgTypes,
} from './GbtScopeShared.ts'
import GbtScopeMeshViewer, {
    type GbtScopeMeshViewerProps,
} from '../components/GbtScopeMeshViewer.tsx'
import type { GbtScopeAnimator } from '../motion/animator.ts'
/* eslint  perfectionist/sort-objects: "off" */

/** Chromatic runs deterministic snapshots — drop time-based animators under CHROMATIC so frames are stable. */
const stillForChromatic = (
    animators: Array<GbtScopeAnimator>,
): Array<GbtScopeAnimator> =>
    process.env['CHROMATIC'] === 'true' ? [] : animators

const meta: Meta<typeof GbtScopeMeshViewer> = {
    args: { ...meshDefaultArgs },
    argTypes,
    component: GbtScopeMeshViewer,
    parameters: { layout: 'centered' },
    tags: ['autodocs'],
    title: 'GbtScope/Mesh Viewer',
} satisfies Meta<typeof GbtScopeMeshViewer>

export default meta

type MeshStory = StoryObj<typeof meta>

const driftAnimators: Array<GbtScopeAnimator> = [
    { mode: 'add', source: 'time', speed: 0.3, target: 'rotation' },
]

const mouseAnimators: Array<GbtScopeAnimator> = [
    {
        curve: { exponent: 1.4, max: 1, multiplier: 0.6 },
        mode: 'add',
        source: 'mouseDistance',
        speed: 2,
        target: 'rotation',
    },
]

/** Baseline 3D mesh viewer — kaleidoscope material on a rotatable box. */
export const STATIC: MeshStory = {
    name: 'Static',
    args: { ...meshDefaultArgs, animators: [] },
}

/** Constant rotation drift. */
export const slowDrift: MeshStory = {
    args: { ...meshDefaultArgs, animators: stillForChromatic(driftAnimators) },
}

/** Rotation reacts to pointer distance from center. */
export const mouseReactive: MeshStory = {
    args: {
        ...meshDefaultArgs,
        animators: stillForChromatic(mouseAnimators),
        segments: 12,
    },
}

/**
 * Motion Playground — every animator parameter as a live slider/select instead of the raw `animators` JSON. Speeds of 0
 * disable a group; the sliders recompose the animators on every Controls change.
 */
export const motionPlayground: StoryObj<
    GbtScopeMeshViewerProps & MotionPlaygroundArgs
> = {
    args: { ...meshDefaultArgs, ...defaultMotionPlaygroundArgs },
    argTypes: motionPlaygroundArgTypes,
    parameters: { chromatic: { disableSnapshot: true } },
    render: (args): ReactElement =>
        createElement(GbtScopeMeshViewer, {
            ...args,
            animators: buildPlaygroundAnimators(args),
        }),
}
