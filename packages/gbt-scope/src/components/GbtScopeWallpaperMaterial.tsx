import {
    type Mesh,
    ShaderMaterial,
    Texture,
    Vector2,
} from '@babylonjs/core'
import { type ReactElement, useEffect, useRef } from 'react'
import { type Dimensions, getResolution } from '../helpers.ts'
import {
    fragmentShader,
    vertexShader,
} from '../materials/shader-wallpaper-groups.ts'
import {
    type GbtScopeWallpaperGroup,
    wallpaperGroupToFloat,
} from '../wallpaper/groups.ts'

export type GbtScopeWallpaperMaterialProps = {
    dimensions?: Dimensions
    group?: GbtScopeWallpaperGroup
    imageAspect?: number
    opacity?: number
    postOffset?: [number, number]
    postRotation?: number
    postScale?: [number, number]
    preOffset?: [number, number]
    preRotation?: number
    preScale?: [number, number]
    repeat?: [number, number]
    src: string
}

export type GbtScopeWallpaperMaterialComponentProps =
    GbtScopeWallpaperMaterialProps & {
        mesh: Mesh | null
        name?: string
        onInit?: (material: ShaderMaterial) => void
        onUpdate?: (material: ShaderMaterial) => void
    }

export const defaultGbtScopeWallpaperMaterialProps = {
    group: 'p1' as GbtScopeWallpaperGroup,
    imageAspect: 1,
    opacity: 1,
    postOffset: [0, 0] as [number, number],
    postRotation: 0,
    postScale: [1, 1] as [number, number],
    preOffset: [0, 0] as [number, number],
    preRotation: 0,
    preScale: [1, 1] as [number, number],
    repeat: [3, 3] as [number, number],
} satisfies Omit<GbtScopeWallpaperMaterialProps, 'src'>

const DEFAULT_DIMENSIONS: Dimensions = { height: 1200, width: 1200 }

const UNIFORMS = [
    'worldViewProjection',
    'uTexture',
    'resolution',
    'uOpacity',
    'uGroup',
    'uRepeat',
    'uPreOffset',
    'uPreScale',
    'uPreRotation',
    'uPostOffset',
    'uPostScale',
    'uPostRotation',
    'uImageAspect',
]

/** Dedicated bitmap material for wallpaper-group UV transforms. */
const GbtScopeWallpaperMaterial = ({
    dimensions = DEFAULT_DIMENSIONS,
    group = defaultGbtScopeWallpaperMaterialProps.group,
    imageAspect = defaultGbtScopeWallpaperMaterialProps.imageAspect,
    mesh,
    name = 'wallpaper-group',
    onInit,
    onUpdate,
    opacity = defaultGbtScopeWallpaperMaterialProps.opacity,
    postOffset = defaultGbtScopeWallpaperMaterialProps.postOffset,
    postRotation = defaultGbtScopeWallpaperMaterialProps.postRotation,
    postScale = defaultGbtScopeWallpaperMaterialProps.postScale,
    preOffset = defaultGbtScopeWallpaperMaterialProps.preOffset,
    preRotation = defaultGbtScopeWallpaperMaterialProps.preRotation,
    preScale = defaultGbtScopeWallpaperMaterialProps.preScale,
    repeat = defaultGbtScopeWallpaperMaterialProps.repeat,
    src,
}: GbtScopeWallpaperMaterialComponentProps): null | ReactElement => {
    const materialRef = useRef<null | ShaderMaterial>(null)

    useEffect(() => {
        if (!src || !mesh) return undefined

        const scene = mesh.getScene()
        const material = new ShaderMaterial(
            name,
            scene,
            { fragmentSource: fragmentShader, vertexSource: vertexShader },
            { attributes: ['position', 'uv'], uniforms: UNIFORMS },
        )
        const texture = new Texture(src, scene, true, false)
        material.setTexture('uTexture', texture)

        // Babylon meshes are imperative; assigning the material is the library API.
        // eslint-disable-next-line react-hooks/immutability
        mesh.material = material
        materialRef.current = material
        onInit?.(material)

        return (): void => {
            texture.dispose()
            material.dispose()
            materialRef.current = null
        }
    }, [mesh, name, onInit, src])

    useEffect(() => {
        const material = materialRef.current
        if (material === null) return

        material.setVector4('resolution', getResolution(dimensions))
        material.setFloat('uOpacity', opacity)
        material.setFloat('uGroup', wallpaperGroupToFloat(group))
        material.setVector2('uRepeat', new Vector2(repeat[0], repeat[1]))
        material.setVector2(
            'uPreOffset',
            new Vector2(preOffset[0], preOffset[1]),
        )
        material.setVector2('uPreScale', new Vector2(preScale[0], preScale[1]))
        material.setFloat('uPreRotation', preRotation)
        material.setVector2(
            'uPostOffset',
            new Vector2(postOffset[0], postOffset[1]),
        )
        material.setVector2(
            'uPostScale',
            new Vector2(postScale[0], postScale[1]),
        )
        material.setFloat('uPostRotation', postRotation)
        material.setFloat('uImageAspect', imageAspect)
        onUpdate?.(material)
    }, [
        dimensions,
        group,
        imageAspect,
        onUpdate,
        opacity,
        postOffset,
        postRotation,
        postScale,
        preOffset,
        preRotation,
        preScale,
        repeat,
    ])

    return null
}

export default GbtScopeWallpaperMaterial
