'use strict';

const surface = document.querySelector('.interaction');
const card = document.querySelector('.card');
const canvas = document.querySelector('.foil');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false, antialias: false });
const tiltDegrees = { x: 7, y: 9 };
const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
const uniforms = {};
const target = { x: 0, y: 0, shine: 0 };
const current = { ...target };
const velocity = { x: 0, y: 0 };
let frame = 0;
let previousTime = 0;

const vertexSource = `
  attribute vec2 position;
  void main() { gl_Position = vec4(position, 0.0, 1.0); }
`;

const fragmentSource = `
  precision highp float;
  uniform vec2 resolution;
  uniform vec2 tilt;
  uniform float strength;

  mat3 orientation(vec2 angle) {
    float cx = cos(angle.x), sx = sin(angle.x);
    float cy = cos(angle.y), sy = sin(angle.y);
    return mat3(cy, sx * sy, -cx * sy, 0.0, cx, sx, sy, -sx * cy, cx * cy);
  }

  vec3 spectrum(float hue) {
    return clamp(abs(fract(hue + vec3(0.0, 0.666667, 0.333333)) * 6.0 - 3.0) - 1.0, 0.0, 1.0);
  }

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / resolution;
    uv.y = 1.0 - uv.y;
    vec2 density = vec2(71.0, 96.0);
    vec2 grid = uv * density;
    vec2 cell = floor(grid);
    float seed = hash(cell);
    vec2 offset = vec2(hash(cell + 3.7), hash(cell + 9.2));
    vec2 flake = abs(fract(grid) - (0.22 + offset * 0.56));
    vec2 size = vec2(mix(0.25, 0.43, seed), mix(0.23, 0.41, offset.x));
    vec2 edge = density / resolution;
    vec2 shape = 1.0 - smoothstep(size - edge * 0.5, size + edge * 0.5, flake);
    float grain = shape.x * shape.y * mix(0.15, 1.0, pow(seed, 0.65));
    mat3 rotation = orientation(tilt);
    vec3 position = rotation * vec3((uv.x - 0.5) * 0.735, 0.5 - uv.y, 0.0);
    vec3 normal = rotation * normalize(vec3((offset - 0.5) * 0.035, 1.0));
    vec3 view = normalize(vec3(0.0, 0.0, 1.66) - position);
    vec3 ray = reflect(-view, normal);
    float phase = ray.y + 2.0 * ray.x * ray.x;
    float band = exp(-pow((phase - 0.22) / 0.095, 4.0));
    float hue = (phase - 0.125) / 0.19 * 0.66;
    vec3 rainbow = spectrum(hue);
    float glint = mix(0.4, 1.5, seed * seed);
    vec3 foil = rainbow * band * grain * glint;
    float panel = exp(-pow((phase - 0.22) / 0.13, 4.0));
    vec3 color = clamp(foil + panel * 0.035, 0.0, 1.0);
    gl_FragColor = vec4(color, strength);
  }
`;

function compileShader(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader));
  }
  return shader;
}

function initializeFoil() {
  if (!gl) return;
  const program = gl.createProgram();
  const shaders = [compileShader(gl.VERTEX_SHADER, vertexSource), compileShader(gl.FRAGMENT_SHADER, fragmentSource)];
  shaders.forEach(shader => gl.attachShader(program, shader));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program));
  }
  shaders.forEach(shader => gl.deleteShader(shader));
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'position');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  uniforms.resolution = gl.getUniformLocation(program, 'resolution');
  uniforms.tilt = gl.getUniformLocation(program, 'tilt');
  uniforms.strength = gl.getUniformLocation(program, 'strength');
  resize();
}

function resize() {
  if (!gl) return;
  const ratio = Math.min(devicePixelRatio, 2);
  canvas.width = Math.round(canvas.clientWidth * ratio);
  canvas.height = Math.round(canvas.clientHeight * ratio);
  gl.viewport(0, 0, canvas.width, canvas.height);
  render();
}

function render() {
  card.style.setProperty('--scale', reducedMotion.matches ? 1 : 1 + current.shine * 0.03);
  card.style.setProperty('--rx', `${-current.y * tiltDegrees.x}deg`);
  card.style.setProperty('--ry', `${current.x * tiltDegrees.y}deg`);
  if (!gl || gl.isContextLost()) return;
  gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
  gl.uniform2f(uniforms.tilt, current.y * tiltDegrees.x * Math.PI / 180, current.x * tiltDegrees.y * Math.PI / 180);
  gl.uniform1f(uniforms.strength, current.shine);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
}

function animate(time) {
  const delta = Math.min(time - (previousTime || time), 64);
  previousTime = time;
  let unsettled = false;
  const step = delta / 1000;
  // Exact critically damped integration keeps the response independent of frame rate.
  const frequency = 16;
  const decay = Math.exp(-frequency * step);
  for (const key of ['x', 'y']) {
    const offset = current[key] - target[key];
    const impulse = (velocity[key] + frequency * offset) * step;
    current[key] = target[key] + (offset + impulse) * decay;
    velocity[key] = (velocity[key] - frequency * impulse) * decay;
    if (Math.abs(current[key] - target[key]) > 0.0001 || Math.abs(velocity[key]) > 0.001) {
      unsettled = true;
    } else {
      current[key] = target[key];
      velocity[key] = 0;
    }
  }
  current.shine += (target.shine - current.shine) * (1 - Math.exp(-delta / 180));
  if (Math.abs(current.shine - target.shine) > 0.001) unsettled = true;
  else current.shine = target.shine;
  render();
  frame = unsettled ? requestAnimationFrame(animate) : 0;
  if (!frame) previousTime = 0;
}

function update(x, y, shine) {
  Object.assign(target, { x, y, shine });
  if (reducedMotion.matches) {
    stopAnimation();
    Object.assign(current, { x: 0, y: 0, shine });
    Object.assign(velocity, { x: 0, y: 0 });
    render();
  } else if (!frame) frame = requestAnimationFrame(animate);
}

function stopAnimation() {
  cancelAnimationFrame(frame);
  frame = 0;
  previousTime = 0;
}

function clampTilt(value) {
  return Math.max(-1, Math.min(1, value));
}

function reset() {
  update(0, 0, 0);
}

function onPointerMove(event) {
  const bounds = surface.getBoundingClientRect();
  const x = (event.clientX - bounds.left) / bounds.width * 2 - 1;
  const y = (event.clientY - bounds.top) / bounds.height * 2 - 1;
  update(clampTilt(x), clampTilt(y), 1);
}
function onKeyDown(event) {
  if (event.key === 'Escape') return reset();
  if (!directions[event.key]) return;
  event.preventDefault();
  const [x, y] = directions[event.key];
  update(clampTilt(target.x + x * 0.2), clampTilt(target.y + y * 0.2), 1);
}
function onVisibilityChange() {
  if (!document.hidden) return;
  stopAnimation();
  Object.assign(current, { x: 0, y: 0, shine: 0 });
  Object.assign(target, current);
  Object.assign(velocity, { x: 0, y: 0 });
  render();
}

surface.addEventListener('pointermove', onPointerMove);
surface.addEventListener('keydown', onKeyDown);
surface.addEventListener('pointerleave', reset);
surface.addEventListener('pointercancel', reset);
surface.addEventListener('pointerup', event => {
  if (event.pointerType !== 'mouse') reset();
});
surface.addEventListener('focus', () => {
  if (surface.matches(':focus-visible')) update(0, 0, 1);
});
surface.addEventListener('blur', reset);
reducedMotion.addEventListener('change', reset);
document.addEventListener('visibilitychange', onVisibilityChange);
canvas.addEventListener('webglcontextlost', event => event.preventDefault());
canvas.addEventListener('webglcontextrestored', initializeFoil);
initializeFoil();
new ResizeObserver(resize).observe(surface);
