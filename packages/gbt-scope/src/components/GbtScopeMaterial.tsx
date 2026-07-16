import { type Mesh, ShaderMaterial, Texture, Vector2 } from '@babylonjs/core'
import { type ReactElement, useEffect, useRef } from 'react'
import { type Dimensions, getResolution } from '../helpers.ts'
import {
    fragmentShader,
    vertexShader,
} from '../materials/shader-radial-symmetry.ts'
import {
    type GbtScopeAnimator,
    type GbtScopeState,
} from '../motion/animator.ts'
import { createGbtScopeDriver } from '../motion/driver.ts'
import { type PointerStateHandle } from '../motion/pointer.ts'
import { type ScrollStateHandle } from '../motion/scroll.ts'
import {
    defaultGbtScopeMaterialProps,
    type GbtScopeMaterialProps,
    type GbtScopeTileMode,
} from '../types.ts'

export type GbtScopeMaterialComponentProps = GbtScopeMaterialProps & {
    name?: string
    /** Mesh the material is applied to. */
    mesh: Mesh | null
    /** Declarative motion rules driven each frame. */
    animators?: GbtScopeAnimator[]
    /** Live pointer + scroll inputs (created by the viewer). */
    pointer: PointerStateHandle
    scroll: ScrollStateHandle
    onInit?: (material: ShaderMaterial) => void
    onUpdate?: (material: ShaderMaterial) => void
}

const DEFAULT_DIMENSIONS: Dimensions = { height: 1200, width: 1200 }

/** Maps a {@link GbtScopeTileMode} to the shader's `uTileMode` float. */
const tileModeToFloat = (mode: GbtScopeTileMode): number =>
    mode === 'none' ? 0 : mode === 'mirror' ? 2 : 1

const UNIFORMS = [
    'worldViewProjection',
    'uTexture',
    'resolution',
    'uOpacity',
    'segments',
    'uOffset',
    'uRotation',
    'uOffsetAmount',
    'uRotationAmount',
    'uScaleFactor',
    'uImageAspect',
    'uTiling',
    'uTileMode',
]

/**
 * Kaleidoscope shader material applied to a Babylon mesh. Static uniforms update reactively from props; the animated
 * uniforms (rotation/offset/scaleFactor/ opacity) are driven each frame by {@link createGbtScopeDriver} from the
 * `animators` + live pointer/scroll inputs. No Babylon Animation is used.
 */
const GbtScopeMaterial = ({
    animators = [],
    dimensions = DEFAULT_DIMENSIONS,
    imageAspect = defaultGbtScopeMaterialProps.imageAspect,
    mesh,
    name = 'kaleidoscope',
    offset = defaultGbtScopeMaterialProps.offset,
    offsetScale = defaultGbtScopeMaterialProps.offsetScale,
    onInit,
    onUpdate,
    opacity = defaultGbtScopeMaterialProps.opacity,
    pointer,
    rotation = defaultGbtScopeMaterialProps.rotation,
    rotationScale = defaultGbtScopeMaterialProps.rotationScale,
    scaleFactor = defaultGbtScopeMaterialProps.scaleFactor,
    scroll,
    segments = defaultGbtScopeMaterialProps.segments,
    src,
    tiling = defaultGbtScopeMaterialProps.tiling,
    tileMode = defaultGbtScopeMaterialProps.tileMode,
}: GbtScopeMaterialComponentProps): ReactElement | null => {
    const materialRef = useRef<ShaderMaterial | null>(null)

    // Live refs read by the render-loop driver.
    const animatorsRef = useRef<GbtScopeAnimator[]>(animators)
    const stateRef = useRef<GbtScopeState>({
        opacity,
        offset: [offset[0], offset[1]],
        rotation,
        scaleFactor,
    })

    // Create the material + driver once per mesh/src.
    useEffect(() => {
        if (!src || !mesh) return undefined

        const scene = mesh.getScene()
        const material = new ShaderMaterial(
            name,
            scene,
            { fragmentSource: fragmentShader, vertexSource: vertexShader },
            { attributes: ['position', 'uv'], uniforms: UNIFORMS },
        )
        material.setTexture('uTexture', new Texture(src, scene, true, false))
        mesh.material = material
        materialRef.current = material

        const disposeDriver = createGbtScopeDriver(scene, material, {
            animatorsRef,
            pointer,
            scroll,
            stateRef,
        })

        onInit?.(material)

        return (): void => {
            disposeDriver()
            material.dispose()
            materialRef.current = null
        }
        // pointer/scroll are stable handles from the viewer; animators/state via refs.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mesh, src, name])

    // Keep animators live.
    useEffect(() => {
        animatorsRef.current = animators
    }, [animators])

    // Re-seed the runtime base state when resting values change (live controls).
    useEffect(() => {
        stateRef.current = {
            opacity,
            offset: [offset[0], offset[1]],
            rotation,
            scaleFactor,
        }
    }, [rotation, offset, scaleFactor, opacity])

    // Static uniforms — updated reactively (the driver owns the animated ones).
    useEffect(() => {
        const material = materialRef.current
        if (!material) return
        material.setVector4('resolution', getResolution(dimensions))
        material.setFloat('segments', segments)
        material.setFloat('uOffsetAmount', offsetScale)
        material.setFloat('uRotationAmount', rotationScale)
        material.setFloat('uImageAspect', imageAspect)
        material.setFloat('uTiling', tiling || 1)
        material.setFloat('uTileMode', tileModeToFloat(tileMode))
        onUpdate?.(material)
    }, [
        dimensions,
        segments,
        offsetScale,
        rotationScale,
        imageAspect,
        tiling,
        tileMode,
        onUpdate,
    ])

    return null
}

export default GbtScopeMaterial
