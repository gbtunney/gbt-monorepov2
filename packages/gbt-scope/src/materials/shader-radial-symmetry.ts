export default {}
export const vertexShader = `
precision highp float;

// Attributes
attribute vec3 position;
attribute vec2 uv;

// Uniforms
uniform mat4 worldViewProjection;

// Varying
varying vec2 vUv;

void main() {
    vUv = uv;
    gl_Position = worldViewProjection * vec4(position, 1.0);
}
`

export const fragmentShader = `
precision mediump float;

// Uniforms
uniform sampler2D uTexture;
uniform vec4 resolution;
uniform float uOpacity;
uniform float segments;
uniform vec2 uOffset;
uniform float uRotation;
uniform float uOffsetAmount;
uniform float uRotationAmount;
uniform float uScaleFactor;
uniform float uImageAspect;
uniform float uTiling; // Tiling factor for the entire pattern
uniform float uTileMode; // 0 = none, 1 = repeat, 2 = mirror

// Varying
varying vec2 vUv;

const float PI = 3.14159265359;

vec2 adjustUV(vec2 uv, vec2 offset, float rotation) {
    float cosRot = cos(rotation * uRotationAmount);
    float sinRot = sin(rotation * uRotationAmount);
    mat2 rotMat = mat2(cosRot, -sinRot, sinRot, cosRot);
    vec2 rotatedUV = rotMat * (uv - vec2(0.5)) + vec2(0.5); // Apply rotation first
    return rotatedUV + offset * uOffsetAmount; // Apply offset after rotation
}

// Mirrored repeat: even tiles use fract, odd tiles use the reversed fract,
// producing seamless mirrored edges instead of hard wraps.
vec2 mirrorUV(vec2 uv) {
    vec2 tile = floor(uv);
    vec2 odd = mod(tile, 2.0);
    return mix(fract(uv), 1.0 - fract(uv), odd);
}

void main() {
    // Adjust UV coordinates for resolution
    vec2 newUV = (vUv - vec2(0.5)) * resolution.zw + vec2(0.5);
    vec2 uv = newUV * 2.0 - 1.0;

    // Convert to polar coordinates
    float angle = atan(uv.y, uv.x);
    float radius = length(uv);

    // Apply kaleidoscope effect
    float segment = PI * 2.0 / segments;
    angle = mod(angle, segment);
    angle = segment - abs(segment / 2.0 - angle);
    uv = radius * vec2(cos(angle), sin(angle));

    // Scale the pattern
    float scale = 1.0 / uScaleFactor;
   
    // Apply tiling to the entire pattern based on the selected tile mode
    vec2 scaledUV = uv * uTiling;
    vec2 tiledUV;
    if (uTileMode < 0.5) {
        tiledUV = uv; // none: no wrapping
    } else if (uTileMode < 1.5) {
        tiledUV = fract(scaledUV); // repeat: square repeats (historical behavior)
    } else {
        tiledUV = mirrorUV(scaledUV); // mirror: seamless mirrored repeats
    }

    // Adjust UV for texture sampling
    vec2 adjustedUV = adjustUV(tiledUV * scale + scale, uOffset, uRotation);
    vec2 aspectCorrectedUV = vec2(adjustedUV.x, adjustedUV.y * uImageAspect);

    // Sample the texture
    vec4 color = texture2D(uTexture, aspectCorrectedUV);
    color.a *= uOpacity;

    // Output the final color
    gl_FragColor = color;
}
`
