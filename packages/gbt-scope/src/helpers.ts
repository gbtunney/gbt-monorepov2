import {
    type ArcRotateCamera,
    Camera,
    type Color3,
    type FreeCamera,
    type Scene,
    type Vector2,
    Vector3,
    Vector4,
} from '@babylonjs/core'

export type Dimensions = {
    height: number
    width: number
}
export type Point = { x: number; y: number }
export type XY = [number, number]
export const getResolution = (dimensions: Dimensions): Vector4 => {
    const { height: _height, width: _width } = dimensions
    const aA = _height / _width > 1 ? _width / _height : 1
    const aB = _height / _width > 1 ? 1 : _height / _width
    return new Vector4(_width, _height, aA, aB)
}
export const distanceBetweenPoints = (pointA: Point, pointB: Point): number =>
    Math.hypot(pointB.x - pointA.x, pointB.y - pointA.y)

export type RGBColor = ConstructorParameters<typeof Color3>
export type Vector2Params = ConstructorParameters<typeof Vector2>
export type Vector3Params = ConstructorParameters<typeof Vector3>
export type Vector4Params = ConstructorParameters<typeof Vector4>
const { x, y, z } = Vector3.Zero()

export type CameraConfigPosition = Partial<{
    enabled: boolean
    hRotation: number /** Alpha Math.PI / 2, // Alpha (horizontal rotation) */
    /** Slow down the zoom speed */
    mouseWheelSpeed: number
    position: Vector3Params
    radius: number
    target: Vector3Params
    vRotation: number /** Beta Math.PI / 4, // Beta (vertical rotation) */
}>
export type CameraOrthoConfig = Pick<
    CameraConfigPosition,
    'enabled' | 'target'
> & { ortho?: true }
export const setOrthoCamera = (
    scene: Scene,
    camera: FreeCamera,
    { enabled = true, ortho = true, target = [0, 0, 0] }: CameraOrthoConfig,
): FreeCamera => {
    camera.setTarget(new Vector3(...target))
    camera.mode = Camera.ORTHOGRAPHIC_CAMERA

    if (enabled) {
        camera.attachControl(scene.getEngine().getRenderingCanvas(), true)
    } else {
        camera.detachControl()
    }
    return camera
}
export const setRotateCameraPosition = (
    camera: ArcRotateCamera,
    scene: Scene,
    {
        enabled = true,
        hRotation = 0,
        mouseWheelSpeed = 0.01,
        position = [x, y, z],
        radius = 10,
        target = [0, 0, 0],
        vRotation = 0,
    }: CameraConfigPosition,
): void => {
    camera.alpha = hRotation
    camera.beta = vRotation
    camera.radius = radius
    camera.wheelDeltaPercentage = mouseWheelSpeed
    //TODO: Fix this scamera.setPosition(new Vector3(...position))
    camera.setTarget(new Vector3(...target))
    if (enabled) {
        camera.attachControl(scene.getEngine().getRenderingCanvas(), true)
    } else {
        camera.detachControl()
    }
}
export default {}
