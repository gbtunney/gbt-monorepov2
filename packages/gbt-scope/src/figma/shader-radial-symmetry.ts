import { defineProperties } from 'figma:shaders'
export default function Effect() {}

export function render(device, frame) {
    const segments = Number(frame.params.segments) || 6
    const scaleFactor = Number(frame.params.scaleFactor) || 1
    const tiling = Number(frame.params.tiling) || 1
    const tileMode = Number(frame.params.tileMode) || 0
    const offsetX = Number(frame.params.offsetX) || 0
    const offsetY = Number(frame.params.offsetY) || 0
    const rotation = Number(frame.params.rotation) || 0
    const opacityValue = Number(frame.params.opacity)
    const offsetAmountValue = Number(frame.params.offsetAmount)
    const rotationAmountValue = Number(frame.params.rotationAmount)
    const opacity = Number.isNaN(opacityValue) ? 1 : opacityValue
    const offsetAmount = Number.isNaN(offsetAmountValue) ? 1 : offsetAmountValue
    const rotationAmount = Number.isNaN(rotationAmountValue)
        ? 1
        : rotationAmountValue

    device.queue.writeBuffer(
        frame.state.uniform,
        0,
        new Float32Array([
            segments,
            scaleFactor,
            tiling,
            tileMode,
            offsetX,
            offsetY,
            rotation,
            opacity,
            offsetAmount,
            rotationAmount,
            0,
            0,
        ]),
    )

    const inputTexture =
        frame.input != null ? frame.input : frame.state.placeholder
    const bindGroup = device.createBindGroup({
        entries: [
            { binding: 0, resource: { buffer: frame.state.uniform } },
            { binding: 1, resource: frame.state.sampler },
            { binding: 2, resource: inputTexture.createView() },
        ],
        layout: frame.state.pipeline.getBindGroupLayout(0),
    })

    const encoder = device.createCommandEncoder()
    const pass = encoder.beginRenderPass({
        colorAttachments: [
            {
                clearValue: { a: 0, b: 0, g: 0, r: 0 },
                loadOp: 'clear',
                storeOp: 'store',
                view: frame.output.createView(),
            },
        ],
    })

    pass.setPipeline(frame.state.pipeline)
    pass.setBindGroup(0, bindGroup)
    pass.setVertexBuffer(0, frame.state.quad)
    pass.draw(6)
    pass.end()

    device.queue.submit([encoder.finish()])
}

export function setup(device, frame) {
    const WGSL = `diagnostic(off,derivative_uniformity);
struct Uniforms {
  p0: vec4f,
  p1: vec4f,
  p2: vec4f,
};

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var samp: sampler;
@group(0) @binding(2) var input: texture_2d<f32>;

struct VsIn {
  @location(0) pos: vec2f,
  @location(1) uv: vec2f,
};
struct VsOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@vertex fn vs_main(in: VsIn) -> VsOut {
  var out: VsOut;
  out.position = vec4f(in.pos, 0.0, 1.0);
  out.uv = in.uv;
  return out;
}

const PI: f32 = 3.14159265359;

fn glsl_mod(x: f32, y: f32) -> f32 {
  return x - floor(x / y) * y;
}

fn glsl_mod_v2(x: vec2f, y: f32) -> vec2f {
  return x - floor(x / y) * y;
}

fn mirror_uv(uv: vec2f) -> vec2f {
  let tile = floor(uv);
  let odd = glsl_mod_v2(tile, 2.0);
  return mix(fract(uv), 1.0 - fract(uv), odd);
}

fn adjust_uv(uv: vec2f, offset: vec2f, rotation: f32, rotation_amount: f32, offset_amount: f32) -> vec2f {
  let cos_rot = cos(rotation * rotation_amount);
  let sin_rot = sin(rotation * rotation_amount);
  let centered = uv - vec2f(0.5);
  let rotated = vec2f(
    centered.x * cos_rot - centered.y * sin_rot,
    centered.x * sin_rot + centered.y * cos_rot
  ) + vec2f(0.5);
  return rotated + offset * offset_amount;
}

@fragment fn fs_main(@location(0) uv_in: vec2f) -> @location(0) vec4f {
  let segments = u.p0.x;
  let scale_factor = u.p0.y;
  let tiling = u.p0.z;
  let tile_mode = u.p0.w;
  let offset = vec2f(u.p1.x, u.p1.y);
  let rotation = u.p1.z;
  let opacity = u.p1.w;
  let offset_amount = u.p2.x;
  let rotation_amount = u.p2.y;

  let dims = vec2f(textureDimensions(input, 0));
  let aspect_ratio = dims.x / dims.y;

  var uv = uv_in * 2.0 - 1.0;
  uv.x = uv.x * aspect_ratio;

  let angle_raw = atan2(uv.y, uv.x);
  let radius = length(uv);

  let segment = PI * 2.0 / segments;
  var angle = glsl_mod(angle_raw, segment);
  angle = segment - abs(segment / 2.0 - angle);

  var kaleid = radius * vec2f(cos(angle), sin(angle));

  var sample_uv = kaleid * 0.5 / scale_factor + 0.5;

  if (tile_mode > 0.5 && tile_mode < 1.5) {
    sample_uv = fract(sample_uv * tiling);
  } else if (tile_mode > 1.5) {
    sample_uv = mirror_uv(sample_uv * tiling);
  }

  sample_uv = adjust_uv(sample_uv, offset, rotation, rotation_amount, offset_amount);

  let final_uv = clamp(sample_uv, vec2f(0.0), vec2f(1.0));
  var color = textureSample(input, samp, final_uv);
  color = vec4f(color.rgb, color.a * opacity);

  return color;
}
`
    G
    const module = device.createShaderModule({ code: WGSL })
    const vertexBuffers = [
        {
            arrayStride: 16,
            attributes: [
                { format: 'float32x2', offset: 0, shaderLocation: 0 },
                { format: 'float32x2', offset: 8, shaderLocation: 1 },
            ],
        },
    ]

    frame.state.pipeline = device.createRenderPipeline({
        fragment: {
            entryPoint: 'fs_main',
            module,
            targets: [{ format: 'rgba8unorm' }],
        },
        layout: 'auto',
        primitive: { topology: 'triangle-list' },
        vertex: { buffers: vertexBuffers, entryPoint: 'vs_main', module },
    })

    frame.state.quad = device.createBuffer({
        mappedAtCreation: true,
        size: 6 * 4 * 4,
        usage: git.VERTEX,
    })
    new Float32Array(frame.state.quad.getMappedRange()).set([
        -1, -1, 0, 1, 1, -1, 1, 1, -1, 1, 0, 0, -1, 1, 0, 0, 1, -1, 1, 1, 1, 1,
        1, 0,
    ])
    frame.state.quad.unmap()

    frame.state.uniform = device.createBuffer({
        size: 48,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })

    frame.state.sampler = device.createSampler({
        addressModeU: 'clamp-to-edge',
        addressModeV: 'clamp-to-edge',
        magFilter: 'linear',
        minFilter: 'linear',
    })

    frame.state.placeholder = device.createTexture({
        format: 'rgba8unorm',
        size: [1, 1, 1],
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    })
    device.queue.writeTexture(
        { texture: frame.state.placeholder },
        new Uint8Array([0, 0, 0, 0]),
        { bytesPerRow: 4 },
        { depthOrArrayLayers: 1, height: 1, width: 1 },
    )
}

defineProperties(Effect, {
    offsetAmount: {
        control: 'slider',
        defaultValue: 1,
        label: 'Offset Amount',
        max: 5,
        min: 0,
        step: 0.05,
        type: 'number',
    },
    offsetX: {
        control: 'slider',
        defaultValue: 0,
        label: 'Offset X',
        max: 1,
        min: -1,
        step: 0.01,
        type: 'number',
    },
    offsetY: {
        control: 'slider',
        defaultValue: 0,
        label: 'Offset Y',
        max: 1,
        min: -1,
        step: 0.01,
        type: 'number',
    },
    opacity: {
        control: 'slider',
        defaultValue: 1,
        label: 'Opacity',
        max: 1,
        min: 0,
        step: 0.01,
        type: 'number',
    },
    rotation: {
        control: 'slider',
        defaultValue: 0,
        label: 'Rotation',
        max: 6.283,
        min: 0,
        step: 0.01,
        type: 'number',
    },
    rotationAmount: {
        control: 'slider',
        defaultValue: 1,
        label: 'Rotation Amount',
        max: 5,
        min: 0,
        step: 0.05,
        type: 'number',
    },
    scaleFactor: {
        control: 'slider',
        defaultValue: 1,
        label: 'Scale',
        max: 5,
        min: 0.1,
        step: 0.05,
        type: 'number',
    },
    segments: {
        control: 'slider',
        defaultValue: 6,
        label: 'Segments',
        max: 20,
        min: 2,
        step: 1,
        type: 'number',
    },
    tileMode: {
        control: 'slider',
        defaultValue: 0,
        label: 'Tile Mode (0=none, 1=repeat, 2=mirror)',
        max: 2,
        min: 0,
        step: 1,
        type: 'number',
    },
    tiling: {
        control: 'slider',
        defaultValue: 1,
        label: 'Tiling',
        max: 10,
        min: 0.5,
        step: 0.1,
        type: 'number',
    },
})
