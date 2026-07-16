import {
    ArcRotateCamera,
    Color4,
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
    type CameraConfigPosition,
    type Dimensions,
    setRotateCameraPosition,
} from '../helpers.ts'
import { createPointerState } from '../motion/pointer.ts'
import { createScrollState } from '../motion/scroll.ts'
import {
    defaultGbtScopeMaterialProps,
    type GbtScopeMaterialProps,
    type GbtScopeViewerBaseProps,
} from '../types.ts'

export type GbtScopeMeshViewerProps = GbtScopeViewerBaseProps &
    Omit<GbtScopeMaterialProps, 'dimensions'> & {
        cameraSettings?: CameraConfigPosition
        name?: string
    }

/** Default props for the 3D mesh viewer — single source of truth for Storybook args. */
// eslint-disable-next-line react-refresh/only-export-components -- Storybook args belong beside the component; costs only HMR granularity.
export const defaultGbtScopeMeshViewerProps = {
    ...defaultGbtScopeMaterialProps,
    animators: [],
    aspect_ratio: 1 as 'parent' | number,
    bg_color: 'black',
    cameraSettings: {
        enabled: true,
        hRotation: Math.PI / 2,
        vRotation: Math.PI / 4,
    } as CameraConfigPosition,
    name: 'gbt-scope-mesh',
    resolution: null as 'screen' | Dimensions | null,
    src: 'uv-checker.png',
} satisfies GbtScopeMeshViewerProps

const GbtScopeMeshViewer = ({
    animators = [],
    aspect_ratio = 1,
    bg_color = 'black',
    cameraSettings = {
        enabled: true,
        hRotation: Math.PI / 2,
        vRotation: Math.PI / 4,
    },
    imageAspect = defaultGbtScopeMaterialProps.imageAspect,
    name = 'gbt-scope-mesh',
    offset = defaultGbtScopeMaterialProps.offset,
    offsetScale = defaultGbtScopeMaterialProps.offsetScale,
    opacity = defaultGbtScopeMaterialProps.opacity,
    resolution = null,
    rotation = defaultGbtScopeMaterialProps.rotation,
    rotationScale = defaultGbtScopeMaterialProps.rotationScale,
    scaleFactor = defaultGbtScopeMaterialProps.scaleFactor,
    segments = defaultGbtScopeMaterialProps.segments,
    src,
    tileMode = defaultGbtScopeMaterialProps.tileMode,
    tiling = defaultGbtScopeMaterialProps.tiling,
}: GbtScopeMeshViewerProps): ReactElement => {
    const [scene, setScene] = useState<null | Scene>(null)
    const [box, setBox] = useState<Mesh | null>(null)

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
        _scene.clearColor = new Color4(0, 0, 0, 0)
        setScene(_scene)

        const camera = new ArcRotateCamera(
            `camera_${name}`,
            cameraSettings.hRotation ?? Math.PI / 2,
            cameraSettings.vRotation ?? Math.PI / 4,
            10,
            Vector3.Zero(),
            _scene,
        )
        setRotateCameraPosition(camera, _scene, cameraSettings)

        new HemisphericLight(`light_${name}`, new Vector3(0, 1, 0), _scene)

        const boxMesh = MeshBuilder.CreateBox(
            `box_${name}`,
            { size: 2 },
            _scene,
        )
        boxMesh.position.y = 1
        setBox(boxMesh)

        const canvas = _scene.getEngine().getRenderingCanvas()
        if (canvas) {
            canvas.tabIndex = 1
            canvas.addEventListener('keydown', (event) => {
                if (event.key === 'Escape')
                    setRotateCameraPosition(camera, _scene, cameraSettings)
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
                {scene && box && (
                    <GbtScopeMaterial
                        animators={animators}
                        dimensions={dimensions}
                        imageAspect={imageAspect}
                        mesh={box}
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

export default GbtScopeMeshViewer
