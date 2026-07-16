import {
    Color4,
    FreeCamera,
    HemisphericLight,
    type Mesh,
    MeshBuilder,
    type Scene,
    Vector3,
} from '@babylonjs/core'
import { isValidColor, parseColorToHexStrict } from '@snailicid3/color'
import SceneComponent from 'babylonjs-hook'
import { type CSSProperties, type ReactElement, useState } from 'react'
import GbtScopeMaterial from './GbtScopeMaterial.tsx'
import {
    type CameraOrthoConfig,
    type Dimensions,
    setOrthoCamera,
} from '../helpers.ts'
import { createPointerState } from '../motion/pointer.ts'
import { createScrollState } from '../motion/scroll.ts'
import {
    defaultGbtScopeMaterialProps,
    type GbtScopeMaterialProps,
    type GbtScopeViewerBaseProps,
} from '../types.ts'

export type GbtScopeFlatViewerProps = GbtScopeViewerBaseProps &
    Omit<GbtScopeMaterialProps, 'dimensions'> & {
        cameraSettings?: CameraOrthoConfig
        name?: string
    }

/** Default props for the flat viewer — single source of truth for Storybook args. */
// eslint-disable-next-line react-refresh/only-export-components -- Storybook args belong beside the component; costs only HMR granularity.
export const defaultGbtScopeFlatViewerProps = {
    ...defaultGbtScopeMaterialProps,
    animators: [],
    aspect_ratio: 1 as 'parent' | number,
    bg_color: 'black',
    cameraSettings: {
        enabled: false,
        ortho: true,
        target: [0, 0, 0],
    } as CameraOrthoConfig,
    name: 'gbt-scope-flat',
    resolution: 'screen' as 'screen' | Dimensions | null,
    src: 'uv-checker.png',
} satisfies GbtScopeFlatViewerProps

const GbtScopeFlatViewer = ({
    animators = [],
    aspect_ratio = 1,
    bg_color = 'black',
    cameraSettings = { enabled: false, ortho: true, target: [0, 0, 0] },
    imageAspect = defaultGbtScopeMaterialProps.imageAspect,
    inputOverrides,
    name = 'gbt-scope-flat',
    offset = defaultGbtScopeMaterialProps.offset,
    offsetScale = defaultGbtScopeMaterialProps.offsetScale,
    opacity = defaultGbtScopeMaterialProps.opacity,
    resolution = 'screen',
    rotation = defaultGbtScopeMaterialProps.rotation,
    rotationScale = defaultGbtScopeMaterialProps.rotationScale,
    scaleFactor = defaultGbtScopeMaterialProps.scaleFactor,
    segments = defaultGbtScopeMaterialProps.segments,
    src,
    tileMode = defaultGbtScopeMaterialProps.tileMode,
    tiling = defaultGbtScopeMaterialProps.tiling,
}: GbtScopeFlatViewerProps): ReactElement => {
    const [scene, setScene] = useState<null | Scene>(null)
    const [plane, setPlane] = useState<Mesh | null>(null)

    // Stable input handles read by the material's render-loop driver.
    const [pointerState] = useState(createPointerState)
    const [scrollState] = useState(createScrollState)

    const customStyle: CSSProperties = {
        backgroundColor: isValidColor(bg_color)
            ? parseColorToHexStrict(bg_color)
            : 'initial',
        border: '2px solid green',
        ...(aspect_ratio !== 'parent' ? { aspectRatio: aspect_ratio } : {}),
    }

    // Derived from resolution + scene; no state needed.
    const dimensions: Dimensions | undefined =
        resolution === 'screen'
            ? scene !== null
                ? {
                      height: scene.getEngine().getRenderHeight(),
                      width: scene.getEngine().getRenderWidth(),
                  }
                : undefined
            : (resolution ?? undefined)

    const onSceneReady = (_scene: Scene): void => {
        _scene.clearColor = new Color4(0, 0, 0, 1)
        setScene(_scene)

        const camera = new FreeCamera(
            `camera_${name}`,
            new Vector3(0, 0, -10),
            _scene,
        )
        setOrthoCamera(_scene, camera, cameraSettings)

        new HemisphericLight(`light_${name}`, new Vector3(0, 1, 0), _scene)

        const planeMesh = MeshBuilder.CreatePlane(
            `plane_${name}`,
            {
                height: _scene.getEngine().getRenderHeight(),
                width: _scene.getEngine().getRenderWidth(),
            },
            _scene,
        )
        setPlane(planeMesh)

        const canvas = _scene.getEngine().getRenderingCanvas()
        if (canvas) {
            canvas.tabIndex = 1
            canvas.addEventListener('keydown', (event) => {
                if (event.key === 'Escape')
                    setOrthoCamera(_scene, camera, cameraSettings)
            })
            pointerState.attach(canvas)
            scrollState.attach()
            _scene.onDisposeObservable.add(() => {
                pointerState.detach(canvas)
                scrollState.detach()
            })
        }
    }

    return (
        <div style={customStyle}>
            <SceneComponent
                antialias
                id="my-canvas"
                onSceneReady={onSceneReady}
                style={{ height: '100%', width: '100%' }}>
                {scene && plane && (
                    <GbtScopeMaterial
                        animators={animators}
                        dimensions={dimensions}
                        imageAspect={imageAspect}
                        inputOverrides={inputOverrides}
                        mesh={plane}
                        name={`material_${name}`}
                        offset={offset}
                        offsetScale={offsetScale}
                        opacity={opacity}
                        pointer={pointerState}
                        rotation={rotation}
                        rotationScale={rotationScale}
                        scaleFactor={scaleFactor}
                        scroll={scrollState}
                        segments={segments}
                        src={src}
                        tileMode={tileMode}
                        tiling={tiling}
                    />
                )}
            </SceneComponent>
        </div>
    )
}

export default GbtScopeFlatViewer
