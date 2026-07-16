import type { Meta, StoryObj } from '@storybook/react'
import GbtScopeMeshViewer from '../components/GbtScopeMeshViewer.tsx'
import type { GbtScopeAnimator } from '../motion/animator.ts'
import { argTypes, meshDefaultArgs } from './GbtScopeShared.ts'
/* eslint  sort/object-properties: "off" */

/** Chromatic runs deterministic snapshots — drop time-based animators under CHROMATIC so frames are stable. */
const stillForChromatic = (
    animators: GbtScopeAnimator[],
): GbtScopeAnimator[] => (process.env['CHROMATIC'] === 'true' ? [] : animators)

const meta: Meta<typeof GbtScopeMeshViewer> = {
    argTypes,
    component: GbtScopeMeshViewer,
    parameters: { layout: 'centered' },
    args: { ...meshDefaultArgs },
    tags: ['autodocs'],
    title: 'GbtScope/Mesh Viewer',
} satisfies Meta<typeof GbtScopeMeshViewer>

export default meta

type MeshStory = StoryObj<typeof meta>

const driftAnimators: GbtScopeAnimator[] = [
    { target: 'rotation', source: 'time', mode: 'add', speed: 0.3 },
]

const mouseAnimators: GbtScopeAnimator[] = [
    {
        target: 'rotation',
        source: 'mouseDistance',
        mode: 'add',
        speed: 2,
        curve: { multiplier: 0.6, max: 1, exponent: 1.4 },
    },
]

/** Baseline 3D mesh viewer — kaleidoscope material on a rotatable box. */
export const Static: MeshStory = {
    args: { ...meshDefaultArgs, animators: [] },
}

/** Constant rotation drift. */
export const SlowDrift: MeshStory = {
    args: { ...meshDefaultArgs, animators: stillForChromatic(driftAnimators) },
}

/** Rotation reacts to pointer distance from center. */
export const MouseReactive: MeshStory = {
    args: {
        ...meshDefaultArgs,
        segments: 12,
        animators: stillForChromatic(mouseAnimators),
    },
}
