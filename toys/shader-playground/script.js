(async function () {
  const canvas = document.querySelector("#shader-canvas");
  const speed = document.querySelector("#speed");
  const status = document.querySelector("#status");

  if (!canvas || !speed || !status) {
    return;
  }

  if (!("gpu" in navigator)) {
    status.textContent = "WebGPU unavailable";
    drawFallback(canvas, "WebGPU is not available in this browser.");
    return;
  }

  let adapter;
  let device;

  try {
    adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      throw new Error("No GPU adapter found.");
    }
    device = await adapter.requestDevice();
  } catch (error) {
    status.textContent = "WebGPU unavailable";
    drawFallback(canvas, error.message);
    return;
  }

  const context = canvas.getContext("webgpu");
  if (!context) {
    status.textContent = "WebGPU unavailable";
    drawFallback(canvas, "WebGPU canvas context is not available.");
    return;
  }

  const format = navigator.gpu.getPreferredCanvasFormat();
  let configured = false;
  const uniformBuffer = device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  });

  const shader = device.createShaderModule({
    code: `
      struct Uniforms {
        resolution: vec2f,
        time: f32,
        speed: f32,
      };

      @group(0) @binding(0) var<uniform> uniforms: Uniforms;

      struct VertexOut {
        @builtin(position) position: vec4f,
      };

      @vertex
      fn vertexMain(@builtin(vertex_index) index: u32) -> VertexOut {
        var positions = array<vec2f, 6>(
          vec2f(-1.0, -1.0),
          vec2f( 1.0, -1.0),
          vec2f(-1.0,  1.0),
          vec2f(-1.0,  1.0),
          vec2f( 1.0, -1.0),
          vec2f( 1.0,  1.0)
        );

        var out: VertexOut;
        out.position = vec4f(positions[index], 0.0, 1.0);
        return out;
      }

      @fragment
      fn fragmentMain(@builtin(position) coord: vec4f) -> @location(0) vec4f {
        let m = min(uniforms.resolution.x, uniforms.resolution.y);
        let uv = (coord.xy * 2.0 - uniforms.resolution) / m;
        let r = length(uv);
        let a = atan2(uv.y, uv.x);
        let t = uniforms.time * uniforms.speed;
        let wave = sin(8.0 * r - t * 1.7) + cos(5.0 * a + t);
        var color = 0.5 + 0.5 * cos(vec3f(0.0, 2.0, 4.0) + wave + r * 3.0);
        color *= smoothstep(1.45, 0.05, r);
        return vec4f(color, 1.0);
      }
    `
  });

  const pipeline = device.createRenderPipeline({
    layout: "auto",
    vertex: {
      module: shader,
      entryPoint: "vertexMain"
    },
    fragment: {
      module: shader,
      entryPoint: "fragmentMain",
      targets: [{ format }]
    },
    primitive: {
      topology: "triangle-list"
    }
  });

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      {
        binding: 0,
        resource: { buffer: uniformBuffer }
      }
    ]
  });

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.floor(canvas.clientWidth * ratio));
    const height = Math.max(1, Math.floor(canvas.clientHeight * ratio));

    if (!configured || canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      context.configure({
        device,
        format,
        alphaMode: "opaque"
      });
      configured = true;
    }
  }

  function frame(now) {
    resize();

    const uniforms = new Float32Array([
      canvas.width,
      canvas.height,
      now / 1000,
      Number(speed.value)
    ]);

    device.queue.writeBuffer(uniformBuffer, 0, uniforms);

    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
          clearValue: { r: 0.06, g: 0.07, b: 0.08, a: 1 },
          loadOp: "clear",
          storeOp: "store"
        }
      ]
    });

    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.draw(6);
    pass.end();

    device.queue.submit([encoder.finish()]);
    status.textContent = "Running WebGPU";
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})();

function drawFallback(canvas, message) {
  const ctx = canvas.getContext("2d");
  const ratio = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.floor(canvas.clientWidth * ratio));
  const height = Math.max(1, Math.floor(canvas.clientHeight * ratio));

  canvas.width = width;
  canvas.height = height;
  ctx.fillStyle = "#101114";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#f3f0e8";
  ctx.font = `${18 * ratio}px SFMono-Regular, Consolas, monospace`;
  ctx.fillText(message, 24 * ratio, 44 * ratio);
  ctx.fillStyle = "#aaa39a";
  ctx.font = `${14 * ratio}px SFMono-Regular, Consolas, monospace`;
  ctx.fillText("Try a browser with WebGPU support over HTTPS.", 24 * ratio, 74 * ratio);
}
