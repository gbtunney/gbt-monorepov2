import type { Meta } from '@storybook/react'
import {
    defaultGbtScopeFlatViewerProps,
    type GbtScopeFlatViewerProps,
} from '../components/GbtScopeFlatViewer.tsx'
import {
    defaultGbtScopeMeshViewerProps,
    type GbtScopeMeshViewerProps,
} from '../components/GbtScopeMeshViewer.tsx'
/* eslint  perfectionist/sort-objects: "off" */

/** Composed default args — single source of truth from the component defaults. */
export const flatDefaultArgs: GbtScopeFlatViewerProps = {
    ...defaultGbtScopeFlatViewerProps,
}

export const meshDefaultArgs: GbtScopeMeshViewerProps = {
    ...defaultGbtScopeMeshViewerProps,
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
