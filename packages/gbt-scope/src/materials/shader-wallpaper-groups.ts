export default {}

export const vertexShader = `
precision highp float;

attribute vec3 position;
attribute vec2 uv;

uniform mat4 worldViewProjection;

varying vec2 vUv;

void main() {
    vUv = uv;
    gl_Position = worldViewProjection * vec4(position, 1.0);
}
`

/**
 * Starter UV mappings for the 17 wallpaper groups. The rectangular and square families are useful immediately; the
 * triangular family intentionally establishes separate, named hooks that can be refined against crystallographic
 * reference fixtures without changing the React API or Storybook stories.
 */
export const fragmentShader = `
precision mediump float;

uniform sampler2D uTexture;
uniform vec4 resolution;
uniform float uOpacity;
uniform float uGroup;
uniform vec2 uRepeat;
uniform vec2 uPreOffset;
uniform vec2 uPreScale;
uniform float uPreRotation;
uniform vec2 uPostOffset;
uniform vec2 uPostScale;
uniform float uPostRotation;
uniform float uImageAspect;

varying vec2 vUv;

const float PI = 3.14159265359;
const float TAU = 6.28318530718;

mat2 rotationMatrix(float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return mat2(c, -s, s, c);
}

vec2 applyTransform(vec2 uv, vec2 offset, vec2 scale, float rotation) {
    vec2 safeScale = max(abs(scale), vec2(0.0001));
    vec2 point = (uv - vec2(0.5)) / safeScale;
    point = rotationMatrix(rotation) * point;
    return point + vec2(0.5) + offset;
}

vec2 mirroredRepeat(vec2 point) {
    vec2 tile = floor(point);
    vec2 local = fract(point);
    vec2 odd = mod(tile, 2.0);
    return mix(local, 1.0 - local, odd);
}

vec2 rotateCell(vec2 local, float quarterTurns) {
    return rotationMatrix(quarterTurns * PI * 0.5) *
        (local - vec2(0.5)) + vec2(0.5);
}

vec2 mapP1(vec2 point) {
    return fract(point);
}

vec2 mapP2(vec2 point) {
    vec2 tile = floor(point);
    vec2 local = fract(point);
    if (mod(tile.x + tile.y, 2.0) > 0.5) local = 1.0 - local;
    return local;
}

vec2 mapPm(vec2 point) {
    vec2 tile = floor(point);
    vec2 local = fract(point);
    if (mod(tile.x, 2.0) > 0.5) local.x = 1.0 - local.x;
    return local;
}

vec2 mapPg(vec2 point) {
    vec2 tile = floor(point);
    vec2 local = fract(point);
    if (mod(tile.x, 2.0) > 0.5) {
        local.y = 1.0 - local.y;
        local.x = fract(local.x + 0.5);
    }
    return local;
}

vec2 mapCm(vec2 point) {
    float row = floor(point.y);
    vec2 centered = point + vec2(0.5 * mod(row, 2.0), 0.0);
    return mapPm(centered);
}

vec2 mapPmm(vec2 point) {
    return mirroredRepeat(point);
}

vec2 mapPmg(vec2 point) {
    vec2 tile = floor(point);
    vec2 local = mirroredRepeat(point);
    if (mod(tile.y, 2.0) > 0.5) local = 1.0 - local;
    return local;
}

vec2 mapPgg(vec2 point) {
    vec2 tile = floor(point);
    vec2 local = fract(point);
    if (mod(tile.x, 2.0) > 0.5) {
        local.y = 1.0 - local.y;
        local.x = fract(local.x + 0.5);
    }
    if (mod(tile.y, 2.0) > 0.5) {
        local.x = 1.0 - local.x;
        local.y = fract(local.y + 0.5);
    }
    return local;
}

vec2 mapCmm(vec2 point) {
    float row = floor(point.y);
    vec2 centered = point + vec2(0.5 * mod(row, 2.0), 0.0);
    return mirroredRepeat(centered);
}

vec2 mapP4(vec2 point) {
    vec2 tile = floor(point);
    vec2 local = fract(point);
    float turns = mod(tile.x + 2.0 * tile.y, 4.0);
    return fract(rotateCell(local, turns));
}

vec2 mapP4m(vec2 point) {
    vec2 local = mirroredRepeat(point);
    if (local.y > local.x) local = local.yx;
    return local;
}

vec2 mapP4g(vec2 point) {
    vec2 tile = floor(point);
    vec2 local = mapP4(point);
    if (mod(tile.x + tile.y, 2.0) > 0.5) {
        local.x = 1.0 - local.x;
        local.y = fract(local.y + 0.5);
    }
    return local;
}

vec2 triangularCell(vec2 point) {
    // Cartesian to a simple oblique/triangular lattice coordinate system.
    mat2 inverseBasis = mat2(1.0, -0.57735026919, 0.0, 1.15470053838);
    return fract(inverseBasis * point);
}

vec2 foldRotational(vec2 point, float order, bool mirrored) {
    vec2 centered = point - vec2(0.5);
    float radius = length(centered);
    float angle = atan(centered.y, centered.x);
    float sector = TAU / order;
    angle = mod(angle + TAU, sector);
    if (mirrored) angle = sector * 0.5 - abs(sector * 0.5 - angle);
    return radius * vec2(cos(angle), sin(angle)) + vec2(0.5);
}

vec2 mapP3(vec2 point) {
    return foldRotational(triangularCell(point), 3.0, false);
}

vec2 mapP3m1(vec2 point) {
    return foldRotational(triangularCell(point), 3.0, true);
}

vec2 mapP31m(vec2 point) {
    vec2 rotated = rotationMatrix(PI / 6.0) * point;
    return foldRotational(triangularCell(rotated), 3.0, true);
}

vec2 mapP6(vec2 point) {
    return foldRotational(triangularCell(point), 6.0, false);
}

vec2 mapP6m(vec2 point) {
    return foldRotational(triangularCell(point), 6.0, true);
}

vec2 mapWallpaper(vec2 point, float group) {
    if (group < 0.5) return mapP1(point);
    if (group < 1.5) return mapP2(point);
    if (group < 2.5) return mapPm(point);
    if (group < 3.5) return mapPg(point);
    if (group < 4.5) return mapCm(point);
    if (group < 5.5) return mapPmm(point);
    if (group < 6.5) return mapPmg(point);
    if (group < 7.5) return mapPgg(point);
    if (group < 8.5) return mapCmm(point);
    if (group < 9.5) return mapP4(point);
    if (group < 10.5) return mapP4m(point);
    if (group < 11.5) return mapP4g(point);
    if (group < 12.5) return mapP3(point);
    if (group < 13.5) return mapP3m1(point);
    if (group < 14.5) return mapP31m(point);
    if (group < 15.5) return mapP6(point);
    return mapP6m(point);
}

void main() {
    vec2 uv = (vUv - vec2(0.5)) * resolution.zw + vec2(0.5);
    uv = applyTransform(uv, uPreOffset, uPreScale, uPreRotation);
    uv = mapWallpaper(uv * max(uRepeat, vec2(0.0001)), uGroup);
    uv = applyTransform(uv, uPostOffset, uPostScale, uPostRotation);
    uv = fract(uv);
    uv.y = (uv.y - 0.5) * uImageAspect + 0.5;

    vec4 color = texture2D(uTexture, uv);
    color.a *= uOpacity;
    gl_FragColor = color;
}
`
