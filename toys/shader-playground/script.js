(function () {
  const canvas = document.querySelector("#shader-canvas");
  const speed = document.querySelector("#speed");
  const status = document.querySelector("#status");
  const gl = canvas.getContext("webgl");

  if (!gl) {
    status.textContent = "WebGL unavailable";
    return;
  }

  const vertexSource = `
    attribute vec2 position;
    void main() {
      gl_Position = vec4(position, 0.0, 1.0);
    }
  `;

  const fragmentSource = `
    precision highp float;
    uniform vec2 resolution;
    uniform float time;

    void main() {
      vec2 uv = (gl_FragCoord.xy * 2.0 - resolution.xy) / min(resolution.x, resolution.y);
      float r = length(uv);
      float a = atan(uv.y, uv.x);
      float wave = sin(8.0 * r - time * 1.7) + cos(5.0 * a + time);
      vec3 color = 0.5 + 0.5 * cos(vec3(0.0, 2.0, 4.0) + wave + r * 3.0);
      color *= smoothstep(1.45, 0.05, r);
      gl_FragColor = vec4(color, 1.0);
    }
  `;

  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader));
    }
    return shader;
  }

  function createProgram() {
    const program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexSource));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSource));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program));
    }
    return program;
  }

  const program = createProgram();
  const buffer = gl.createBuffer();
  const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
  const position = gl.getAttribLocation(program, "position");
  const resolution = gl.getUniformLocation(program, "resolution");
  const time = gl.getUniformLocation(program, "time");

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
  gl.useProgram(program);
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.floor(canvas.clientWidth * ratio);
    const height = Math.floor(canvas.clientHeight * ratio);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    }
  }

  function frame(now) {
    resize();
    gl.uniform2f(resolution, canvas.width, canvas.height);
    gl.uniform1f(time, (now / 1000) * Number(speed.value));
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    status.textContent = "Running WebGL";
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})();
