import type { Meta } from '@storybook/react'
import {
    defaultGbtScopeFlatViewerProps,
    type GbtScopeFlatViewerProps,
} from '../components/GbtScopeFlatViewer.tsx'
import {
    defaultGbtScopeMeshViewerProps,
    type GbtScopeMeshViewerProps,
} from '../components/GbtScopeMeshViewer.tsx'
/* eslint  sort/object-properties: "off" */
/* eslint filenames-simple/naming-convention: 'off'*/

/** Composed default args — single source of truth from the component defaults. */
export const flatDefaultArgs: GbtScopeFlatViewerProps = {
    ...defaultGbtScopeFlatViewerProps,
}

export const meshDefaultArgs: GbtScopeMeshViewerProps = {
    ...defaultGbtScopeMeshViewerProps,
}

export const argTypes: Meta['argTypes'] = {
    bg_color: { control: 'color' },
    resolution: { control: 'object' },

    //  General Settings
    src: {
        control: { type: 'select' },
        options: ['uv-checker.png', 'gradient4-3.png', 'eel.jpg'],
        table: { category: 'General Settings' },
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
    imageAspect: {
        description: 'Src image aspect ratio',
        control: { max: 4, min: 0.01, step: 0.1, type: 'number' },
        table: { category: 'General Settings' },
    },

    //  Graphic Settings
    tiling: {
        control: { max: 20, min: 1, step: 1, type: 'number' },
        table: { category: 'Graphic Settings' },
    },
    tileMode: {
        description: 'Tiling strategy applied after the radial fold',
        control: { type: 'select' },
        options: ['none', 'repeat', 'mirror'],
        table: { category: 'Graphic Settings' },
    },
    scaleFactor: {
        control: { max: 3, min: 0.01, step: 0.1, type: 'number' },
        table: { category: 'Graphic Settings' },
    },
    segments: {
        control: { max: 30, min: 1, step: 1, type: 'number' },
        table: { category: 'Graphic Settings' },
    },
    opacity: {
        control: { max: 1, min: 0, step: 0.01, type: 'number' },
        table: { category: 'Graphic Settings' },
    },

    //  Rotation / Offset base values
    rotation: {
        control: { max: 360, min: 0, step: 0.1, type: 'number' },
        table: { category: 'Transform' },
    },
    rotationScale: {
        control: { max: 4, min: 0.001, step: 0.001, type: 'number' },
        table: { category: 'Transform' },
    },
    offset: {
        control: { type: 'object' },
        table: { category: 'Transform' },
    },
    offsetScale: {
        control: { max: 4, min: 0.001, step: 0.01, type: 'number' },
        table: { category: 'Transform' },
    },

    //  Motion — declarative animators
    animators: {
        description:
            'Declarative motion rules: { target, source, mode, speed, curve }[]',
        control: { type: 'object' },
        table: { category: 'Motion' },
    },
}
