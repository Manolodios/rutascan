// MagnetLines - Vanilla JS Version (adapted from React Bits)
// WebGL2 Magnetic Field Lines Component
// Source: React Bits - https://reactbits.dev

(function() {
  const VERTEX_SHADER = `#version 300 es
layout(location = 0) in vec2 aCorner;
layout(location = 1) in vec2 aCenter;
layout(location = 2) in vec4 aState;
uniform mat3 uView;
uniform vec2 uCanvas;
uniform vec2 uOffset;
uniform vec2 uLine;
uniform float uStretch;
uniform float uHead;
uniform float uPad;
uniform float uFar;
out vec2 vLocal;
out vec2 vHalf;
out float vEmphasis;
out float vFlash;
out float vAngle;
out float vShown;
void main() {
  float angle = aState.x;
  float emphasis = aState.y;
  float halfLength = uLine.x * (1.0 + uStretch * emphasis);
  float halfWidth = uLine.y;
  vec2 extent = vec2(halfLength + uPad, max(halfWidth, uHead * halfLength) + uPad);
  vec2 local = aCorner * extent;
  vec2 axis = vec2(cos(angle), sin(angle));
  vec2 point = aCenter + axis * local.x + vec2(-axis.y, axis.x) * local.y;
  vec3 screen = uView * vec3(point, 1.0);
  vec2 scale = vec2(2.0 / uCanvas.x, -2.0 / uCanvas.y);
  vec2 shift = vec2(-1.0 + 2.0 * uOffset.x / uCanvas.x, 1.0 - 2.0 * uOffset.y / uCanvas.y);
  gl_Position = vec4(screen.xy * scale + shift * screen.z, 0.0, screen.z);
  float depth = (uView * vec3(aCenter, 1.0)).z;
  vLocal = local;
  vHalf = vec2(halfLength, halfWidth);
  vEmphasis = emphasis;
  vFlash = aState.z;
  vAngle = angle;
  vShown = aState.w * (1.0 - smoothstep(uFar * 0.45, uFar, depth));
}`;

  const FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 vLocal;
in vec2 vHalf;
in float vEmphasis;
in float vFlash;
in float vAngle;
in float vShown;
out vec4 fragColor;
uniform vec3 uColor;
uniform vec3 uAccent;
uniform float uAccentMix;
uniform float uOpacity;
uniform float uFade;
uniform int uShape;
uniform float uHead;
uniform float uRainbow;
uniform float uTone;
uniform float uPeriod;
uniform vec2 uCanvas;
uniform vec2 uOffset;
uniform vec2 uPixels;
uniform vec2 uEdge;

float ndot(vec2 a, vec2 b) {
  return a.x * b.x - a.y * b.y;
}

float rhombus(vec2 p, vec2 b) {
  p = abs(p);
  float h = clamp(ndot(b - 2.0 * p, b) / dot(b, b), -1.0, 1.0);
  float d = length(p - 0.5 * b * vec2(1.0 - h, 1.0 + h));
  return d * sign(p.x * b.y + p.y * b.x - b.x * b.y);
}

float triangle(vec2 p, vec2 q) {
  p.x = abs(p.x);
  vec2 a = p - q * clamp(dot(p, q) / dot(q, q), 0.0, 1.0);
  vec2 b = p - q * vec2(clamp(p.x / q.x, 0.0, 1.0), 1.0);
  float s = -sign(q.y);
  vec2 d = min(vec2(dot(a, a), s * (p.x * q.y - p.y * q.x)), vec2(dot(b, b), s * (p.y - q.y)));
  return -sqrt(d.x) * sign(d.y);
}

float capsule(vec2 p, float from, float to, float radius) {
  float x = clamp(p.x, from, to);
  return length(vec2(p.x - x, p.y)) - radius;
}

float feather(float distance, float zone) {
  if (zone <= 0.0) return 1.0;
  float t = clamp(distance / zone, 0.0, 1.0);
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

vec3 spectrum(float hue, float tone) {
  vec3 k = clamp(abs(fract(hue + vec3(0.0, 2.0, 1.0) / 3.0) * 6.0 - 3.0) - 1.0, 0.0, 1.0);
  k = k * k * (3.0 - 2.0 * k);
  float chroma = (1.0 - abs(2.0 * tone - 1.0)) * 0.92;
  return tone + chroma * (k - 0.5);
}

void main() {
  vec2 p = vLocal;
  float aa = max(length(fwidth(p)) * 0.7071, 0.0001);
  float halfWidth = max(vHalf.y, aa * 0.5);
  float thin = vHalf.y / halfWidth;
  float halfLength = max(vHalf.x, halfWidth);
  float d;
  if (uShape == 1) {
    float head = min(halfLength * 0.9, max(halfWidth * 4.5, halfLength * 0.55));
    float wing = max(uHead * halfLength, halfWidth * 2.2);
    float shaft = capsule(p, -halfLength + halfWidth, halfLength - head * 0.6, halfWidth);
    float tip = triangle(vec2(p.y, halfLength - p.x), vec2(wing, head));
    d = min(shaft, tip);
  } else if (uShape == 2) {
    d = rhombus(p, vec2(halfLength, max(uHead * halfLength, halfWidth)));
  } else {
    d = capsule(p, -halfLength + halfWidth, halfLength - halfWidth, halfWidth);
  }
  float coverage = clamp(0.5 - d / aa, 0.0, 1.0) * thin;
  if (coverage <= 0.0) discard;

  float emphasis = clamp(vEmphasis + vFlash, 0.0, 1.0);
  vec3 color = mix(uColor, uAccent, uAccentMix * emphasis);
  if (uShape == 2) {
    float north = smoothstep(-aa, aa, p.x);
    color = mix(uColor, uAccent, north);
  }
  if (uRainbow > 0.5) {
    float hue = fract(vAngle / uPeriod);
    vec3 tint = spectrum(hue, uTone);
    color = uShape == 2 ? mix(tint, uColor, 1.0 - smoothstep(-aa, aa, p.x)) : tint;
  }
  float alpha = uOpacity * mix(1.0 - uFade, 1.0, clamp(vEmphasis, 0.0, 1.0));
  alpha = clamp(alpha + vFlash * 0.6, 0.0, 1.0) * coverage * vShown;
  vec2 point = vec2(gl_FragCoord.x, uPixels.y - gl_FragCoord.y) * (uCanvas / uPixels) - uOffset;
  vec2 inside = min(point, uCanvas - 2.0 * uOffset - point);
  alpha *= feather(inside.x, uEdge.x) * feather(inside.y, uEdge.y);
  fragColor = vec4(color * alpha, alpha);
}`;

  const MODES = ['orbit', 'attract', 'spiral', 'dipole'];
  const SHAPES = { line: 0, arrow: 1, needle: 2 };
  const TAU = Math.PI * 2;
  const PULSE_SPEED = 520;
  const PULSE_SPIN = 0.34;
  const INTRO_SPEED = 700;
  const INTRO_TIME = 1.1;
  const INTRO_SPIN = 0.65;
  const FAR = 4;
  const MAX_LINES = 30000;

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const smootherstep = t => t * t * t * (t * (t * 6 - 15) + 10);
  const wrap = (value, period) => {
    const half = period / 2;
    return ((((value + half) % period) + period) % period) - half;
  };
  const seedFor = (column, row) => {
    let hash = Math.imul(column + 40503, 2246822519) ^ Math.imul(row + 9973, 3266489917);
    hash = Math.imul(hash ^ (hash >>> 15), 668265263);
    hash = Math.imul(hash ^ (hash >>> 13), 374761393);
    return (((hash ^ (hash >>> 16)) >>> 0) / 4294967296) * 2 - 1;
  };
  const parseColor = value => {
    const text = String(value || '').trim();
    const hex = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text);
    if (hex) {
      const full = hex[1].length === 3 ? hex[1].replace(/./g, digit => digit + digit) : hex[1];
      return [0, 2, 4].map(index => parseInt(full.slice(index, index + 2), 16) / 255);
    }
    const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(text);
    if (rgb) return [rgb[1], rgb[2], rgb[3]].map(channel => clamp(parseFloat(channel) / 255, 0, 1));
    return [0.94, 0.94, 0.94];
  };
  const lightness = rgb => (Math.max(...rgb) + Math.min(...rgb)) / 2;

  const compileShader = (gl, type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  };

  const multiply = (a, b) => {
    const out = [];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        out.push(a[r * 3] * b[c] + a[r * 3 + 1] * b[c + 3] + a[r * 3 + 2] * b[c + 6]);
      }
    }
    return out;
  };

  const invert = m => {
    const [a, b, c, d, e, f, g, h, i] = m;
    const A = e * i - f * h;
    const B = f * g - d * i;
    const C = d * h - e * g;
    const det = a * A + b * B + c * C;
    return [A, c * h - b * i, b * f - c * e, B, a * i - c * g, c * d - a * f, C, b * g - a * h, a * e - b * d].map(value => value / det);
  };

  const apply = (m, x, y) => {
    const w = m[6] * x + m[7] * y + m[8];
    return [(m[0] * x + m[1] * y + m[2]) / w, (m[3] * x + m[4] * y + m[5]) / w, w];
  };

  const viewFor = (tiltX, tiltY, width, height, fill) => {
    const ax = (tiltX * Math.PI) / 180;
    const ay = (tiltY * Math.PI) / 180;
    const depth = Math.max(width, height) * 1.25;
    const tilt = [
      Math.cos(ay), 0, 0,
      Math.sin(ax) * Math.sin(ay), Math.cos(ax), 0,
      (Math.sin(ay) * Math.cos(ax)) / depth, -Math.sin(ax) / depth, 1
    ];
    if (fill) {
      const forward = multiply([1, 0, width / 2, 0, 1, height / 2, 0, 0, 1], tilt);
      return { forward, inverse: invert(forward), minScale: 1, maxScale: 1 };
    }
    const corners = [
      [-width / 2, -height / 2],
      [width / 2, -height / 2],
      [width / 2, height / 2],
      [-width / 2, height / 2]
    ].map(([x, y]) => apply(tilt, x, y));
    const xs = corners.map(point => point[0]);
    const ys = corners.map(point => point[1]);
    const spanX = Math.max(...xs) - Math.min(...xs);
    const spanY = Math.max(...ys) - Math.min(...ys);
    const fit = Math.min(1, width / Math.max(1, spanX), height / Math.max(1, spanY));
    const midX = (Math.max(...xs) + Math.min(...xs)) / 2;
    const midY = (Math.max(...ys) + Math.min(...ys)) / 2;
    const place = [fit, 0, width / 2 - midX * fit, 0, fit, height / 2 - midY * fit, 0, 0, 1];
    const forward = multiply(place, tilt);
    const scales = corners.map(point => fit / Math.abs(point[2]));
    return { forward, inverse: invert(forward), minScale: Math.min(...scales), maxScale: Math.max(...scales) };
  };

  class MagnetLines {
    constructor(container, options = {}) {
      this.container = typeof container === 'string' ? document.querySelector(container) : container;
      if (!this.container) return;

      this.options = {
        spacing: 30,
        rows: 0,
        columns: 0,
        containerSize: null,
        lineColor: '#dc1928',
        accentColor: null,
        lineWidth: 2,
        lineHeight: 18,
        baseAngle: -10,
        mode: 'attract',
        shape: 'needle',
        rainbow: false,
        radius: 200,
        fade: 0.35,
        edgeFade: 0,
        stretch: 0.2,
        reach: 0,
        scatter: 0,
        inertia: 0.35,
        bounce: 0.55,
        ripple: 0.3,
        clickPulse: true,
        intro: true,
        idle: false,
        tiltX: 0,
        tiltY: 0,
        maxDevicePixelRatio: 2,
        className: '',
        style: {}
      };
      Object.assign(this.options, options);

      this.createElements();
      this.setupWebGL();
      this.bindEvents();
      this.wake();
    }

    createElements() {
      const container = this.container;
      container.style.position = 'relative';
      container.style.width = '100%';
      container.style.height = '100%';
      container.style.overflow = 'hidden';

      const canvas = document.createElement('canvas');
      canvas.className = 'magnet-lines__canvas';
      canvas.setAttribute('aria-hidden', 'true');
      container.appendChild(canvas);

      const probe = document.createElement('span');
      probe.className = 'magnet-lines__probe';
      probe.setAttribute('aria-hidden', 'true');
      probe.style.cssText = 'position: absolute; top: 0; left: 0; height: 0; visibility: hidden; pointer-events: none;';
      container.appendChild(probe);

      this.canvas = canvas;
      this.probe = probe;
      this.gl = null;
      this.program = null;
      this.uniforms = {};
      this.vao = null;
      this.cornerBuffer = null;
      this.centerBuffer = null;
      this.stateBuffer = null;
      this.raf = null;
      this.last = 0;
      this.clock = 0;
      this.visible = true;
      this.pageVisible = document.visibilityState !== 'hidden';
      this.lost = false;
      this.dirty = true;

      this.field = { width: 1, height: 1, pad: 0, ratio: 1, view: null, length: 20, thickness: 2, fill: true, edgePad: 1, minScale: 1, maxScale: 1 };
      this.pointer = { x: 0, y: 0, vx: 0, vy: 0, time: 0, seen: false, inside: false, away: 0 };
      this.target = { x: 0, y: 0, heading: 0 };
      this.pulses = [];
      this.count = 0;
      this.centers = new Float32Array(0);
      this.cells = new Int32Array(0);
      this.reveal = new Float32Array(0);
      this.seeds = new Float32Array(0);
      this.rests = new Float32Array(0);
      this.angles = new Float32Array(0);
      this.speeds = new Float32Array(0);
      this.seenX = new Float32Array(0);
      this.seenY = new Float32Array(0);
      this.pending = new Uint8Array(0);
      this.state = new Float32Array(0);
      this.introStart = -1;
      this.introLive = false;
    }

    setupWebGL() {
      const canvas = this.canvas;
      const gl = canvas.getContext('webgl2', {
        alpha: true,
        premultipliedAlpha: true,
        antialias: false,
        depth: false,
        stencil: false,
        powerPreference: 'default'
      });

      if (!gl) {
        console.warn('WebGL2 not supported');
        this.canvas.style.display = 'none';
        return;
      }

      this.gl = gl;
      this.createProgram();
      this.setupBuffers();
      this.resize();
    }

    createProgram() {
      const gl = this.gl;
      const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
      const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
      const program = gl.createProgram();
      gl.attachShader(program, vertex);
      gl.attachShader(program, fragment);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error(gl.getProgramInfoLog(program));
        return;
      }
      this.program = program;
      this.uniforms = {};
      const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < count; i++) {
        const info = gl.getActiveUniform(program, i);
        if (info) this.uniforms[info.name] = gl.getUniformLocation(program, info.name);
      }
    }

    setupBuffers() {
      const gl = this.gl;
      this.vao = gl.createVertexArray();
      gl.bindVertexArray(this.vao);

      this.cornerBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.cornerBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

      this.centerBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.centerBuffer);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);
      gl.vertexAttribDivisor(1, 1);

      this.stateBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.stateBuffer);
      gl.enableVertexAttribArray(2);
      gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 0, 0);
      gl.vertexAttribDivisor(2, 1);

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    }

    resize() {
      const canvas = this.canvas;
      const rect = this.container.getBoundingClientRect();
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      canvas.width = Math.max(1, Math.round(width * Math.min(window.devicePixelRatio || 1, 2)));
      canvas.height = Math.max(1, Math.round(height * Math.min(window.devicePixelRatio || 1, 2)));
      this.rebuild();
    }

    rebuild() {
      const s = this.options;
      const rect = this.container.getBoundingClientRect();
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      const length = Math.max(1, s.lineHeight);
      const thickness = Math.max(0.25, s.lineWidth);
      const fill = !this.options.containerSize;
      const tiled = fill && (s.tiltX !== 0 || s.tiltY !== 0);

      const view = viewFor(s.tiltX, s.tiltY, width, height, fill);
      const ratio = Math.min(window.devicePixelRatio || 1, s.maxDevicePixelRatio);

      let columnCount = Math.max(1, Math.round(s.columns || (s.rows ? (s.rows * width) / height : width / s.spacing)));
      let rowCount = Math.max(1, Math.round(s.rows || (s.columns ? (s.columns * height) / width : height / s.spacing)));
      if (columnCount * rowCount > MAX_LINES) {
        const shrink = Math.sqrt((columnCount * rowCount) / MAX_LINES);
        columnCount = Math.max(1, Math.floor(columnCount / shrink));
        rowCount = Math.max(1, Math.floor(rowCount / shrink));
      }

      const key = [fill, columnCount, rowCount, width.toFixed(1), height.toFixed(1), tiled ? `${s.tiltX},${s.tiltY}` : ''].join('|');
      if (key !== this.field.key) {
        this.field.key = key;
        this.layout(width, height, view, columnCount, rowCount, tiled);
      }

      const minScale = fill ? this.field.minScale : this.field.view.minScale;
      const maxScale = fill ? this.field.maxScale : this.field.view.maxScale;
      const pad = fill ? 0 : Math.ceil((length * (1 + s.stretch) + thickness * 2) * Math.max(1, maxScale) + 8);
      const canvasWidth = width + pad * 2;
      const canvasHeight = height + pad * 2;

      this.canvas.style.left = -pad + 'px';
      this.canvas.style.top = -pad + 'px';
      this.canvas.style.width = canvasWidth + 'px';
      this.canvas.style.height = canvasHeight + 'px';

      const pixelWidth = Math.max(1, Math.round(canvasWidth * ratio));
      const pixelHeight = Math.max(1, Math.round(canvasHeight * ratio));
      if (this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight) {
        this.canvas.width = pixelWidth;
        this.canvas.height = pixelHeight;
      }

      Object.assign(this.field, { width, height, pad, ratio, view, length, thickness, fill, edgePad: 2 / (ratio * Math.max(0.05, minScale)) });
    }

    layout(width, height, view, columnCount, rowCount, tiled) {
      const cellX = width / columnCount;
      const cellY = height / rowCount;
      const range = tiled ? visibleRange(this.field.view, width, height, cellX, cellY) : { fromColumn: 0, toColumn: columnCount - 1, fromRow: 0, toRow: rowCount - 1 };
      const origin = apply(this.field.view.forward, 0, 0);
      const found = [];

      if (range) {
        for (let row = range.fromRow; row <= range.toRow; row++) {
          const y = (row + 0.5) * cellY - height / 2;
          for (let column = range.fromColumn; column <= range.toColumn; column++) {
            const x = (column + 0.5) * cellX - width / 2;
            const [screenX, screenY, w] = apply(this.field.view.forward, x, y);
            if (tiled) {
              if (w <= 0 || w > FAR) continue;
              const margin = (0.49 * Math.min(cellX, cellY)) / w;
              if (screenX < -margin || screenX > width + margin || screenY < -margin || screenY > height + margin) continue;
            }
            found.push({ x, y, column, row, w, distance: Math.hypot(screenX - origin[0], screenY - origin[1]) });
          }
        }
      }

      if (found.length > MAX_LINES) {
        found.sort((a, b) => a.w - b.w);
        found.length = MAX_LINES;
      }

      const previous = new Map();
      for (let i = 0; i < this.count; i++) previous.set(this.cells[i * 2] * 65536 + this.cells[i * 2 + 1], i);
      const total = found.length;
      const next = {
        centers: new Float32Array(total * 2),
        cells: new Int32Array(total * 2),
        reveal: new Float32Array(total),
        seeds: new Float32Array(total),
        rests: new Float32Array(total),
        angles: new Float32Array(total),
        speeds: new Float32Array(total),
        seenX: new Float32Array(total),
        seenY: new Float32Array(total),
        pending: new Uint8Array(total)
      };
      let farthest = 0;
      let nearest = Infinity;
      let deepest = 0;
      const bounds = [Infinity, Infinity, -Infinity, -Infinity];

      found.forEach((item, index) => {
        next.centers[index * 2] = item.x;
        next.centers[index * 2 + 1] = item.y;
        next.cells[index * 2] = item.column;
        next.cells[index * 2 + 1] = item.row;
        next.reveal[index] = item.distance;
        next.seeds[index] = seedFor(item.column, item.row);
        farthest = Math.max(farthest, item.distance);
        nearest = Math.min(nearest, item.w);
        deepest = Math.max(deepest, item.w);
        bounds[0] = Math.min(bounds[0], item.x);
        bounds[1] = Math.min(bounds[1], item.y);
        bounds[2] = Math.max(bounds[2], item.x);
        bounds[3] = Math.max(bounds[3], item.y);
        const old = previous.get(item.column * 65536 + item.row);
        if (old === undefined) {
          next.pending[index] = 1;
          return;
        }
        next.angles[index] = this.angles[old];
        next.speeds[index] = this.speeds[old];
        next.seenX[index] = this.seenX[old];
        next.seenY[index] = this.seenY[old];
      });

      this.count = total;
      this.centers = next.centers;
      this.cells = next.cells;
      this.reveal = next.reveal;
      this.seeds = next.seeds;
      this.rests = next.rests;
      this.angles = next.angles;
      this.speeds = next.speeds;
      this.seenX = next.seenX;
      this.seenY = next.seenY;
      this.pending = next.pending;
      this.state = new Float32Array(total * 4);
      this.field.introSpeed = Math.max(INTRO_SPEED, farthest / INTRO_TIME);
      this.field.bounds = total ? bounds : [0, 0, 0, 0];
      this.field.minScale = total ? 1 / deepest : 1;
      this.field.maxScale = total ? 1 / nearest : 1;

      const gl = this.gl;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.centerBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, this.centers, gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.stateBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, this.state.byteLength || 16, gl.DYNAMIC_DRAW);
    }

    bindEvents() {
      const container = this.container;

      this.onPointerMove = (event) => {
        const spot = this.toPlane(event.clientX, event.clientY);
        if (!spot) return;
        const now = performance.now();
        const dt = Math.max(1, now - this.pointer.time) / 1000;
        if (this.pointer.seen && dt < 0.2) {
          this.pointer.vx = this.pointer.vx * 0.6 + ((spot.x - this.pointer.x) / dt) * 0.4;
          this.pointer.vy = this.pointer.vy * 0.6 + ((spot.y - this.pointer.y) / dt) * 0.4;
        }
        this.pointer.time = now;
        this.pointer.x = spot.x;
        this.pointer.y = spot.y;
        this.pointer.seen = true;
        this.pointer.inside = spot.inside;
        if (spot.inside) this.pointer.away = 0;
        this.wake();
      };

      this.onPointerDown = (event) => {
        this.onPointerMove(event);
        const s = this.options;
        if (!s.clickPulse || this.reduced || !this.count) return;
        const spot = this.toPlane(event.clientX, event.clientY);
        if (!spot) return;
        const inside = s.fill ? spot.inside : Math.abs(spot.x) <= this.field.width / 2 && Math.abs(spot.y) <= this.field.height / 2;
        if (!inside) return;
        const [minX, minY, maxX, maxY] = this.field.bounds;
        const farthest = Math.max(
          Math.hypot(spot.x - minX, spot.y - minY),
          Math.hypot(spot.x - maxX, spot.y - minY),
          Math.hypot(spot.x - minX, spot.y - maxY),
          Math.hypot(spot.x - maxX, spot.y - maxY)
        );
        this.pulses.push({ x: spot.x, y: spot.y, start: this.clock, life: Math.min(6, farthest / PULSE_SPEED + PULSE_SPIN + 0.1) });
        if (this.pulses.length > 6) this.pulses.shift();
        this.wake();
      };

      this.onLeave = () => {
        this.pointer.inside = false;
        this.wake();
      };

      window.addEventListener('pointermove', this.onPointerMove, { passive: true });
      window.addEventListener('pointerdown', this.onPointerDown, { passive: true });
      document.documentElement.addEventListener('pointerleave', this.onLeave);

      this.resizeObserver = new ResizeObserver(() => {
        this.dirty = true;
        this.wake();
      });
      this.resizeObserver.observe(this.container);

      this.onResize = () => {
        this.dirty = true;
        this.wake();
      };
      window.addEventListener('resize', this.onResize);

      this.intersection = new IntersectionObserver((entries) => {
        this.visible = entries.some(entry => entry.isIntersecting);
        this.wake();
      });
      this.intersection.observe(this.container);

      this.onVisibility = () => {
        this.pageVisible = document.visibilityState !== 'hidden';
        this.wake();
      };
      document.addEventListener('visibilitychange', this.onVisibility);
    }

    toPlane(clientX, clientY) {
      if (!this.field.view) return null;
      const rect = this.container.getBoundingClientRect();
      const [x, y, w] = apply(this.field.view.inverse, clientX - rect.left, clientY - rect.top);
      if (w <= 0) return null;
      const inside = clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
      return { x, y, inside };
    }

    wake() {
      if (this.raf || this.lost || !this.visible || !this.pageVisible) return;
      this.last = performance.now();
      this.raf = requestAnimationFrame(() => this.frame(this.last));
    }

    fieldAngle(s, index, px, py) {
      const dx = px - this.centers[index * 2];
      const dy = py - this.centers[index * 2 + 1];
      if (s.mode === 'dipole') {
        const distance = Math.hypot(dx, dy) || 1;
        const rx = -dx / distance;
        const ry = -dy / distance;
        const mx = Math.cos(this.target.heading);
        const my = Math.sin(this.target.heading);
        const dot = mx * rx + my * ry;
        return Math.atan2(3 * dot * ry - my, 3 * dot * rx - mx);
      }
      const toward = Math.atan2(dy, dx);
      if (s.mode === 'attract') return toward;
      if (s.mode === 'spiral') return toward + Math.PI / 4;
      return toward + Math.PI / 2;
    }

    frame(now) {
      this.raf = null;
      if (this.lost) return;

      const s = this.options;
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const dt = clamp((now - this.last) / 1000 || 0, 0, 0.05);
      this.last = Math.max(this.last, now);
      this.clock += dt;
      if (this.dirty) {
        this.resize();
        this.rebuild();
        this.dirty = false;
      }

      const period = s.shape === 'line' ? Math.PI : TAU;
      const spread = s.scatter * Math.PI * 0.5;
      for (let index = 0; i < this.count; i++) {
        this.rests[index] = s.baseAngle * Math.PI / 180 + Math.PI / 2 + this.seeds[index] * spread;
      }

      const wandering = s.idle && !reduced && (!this.pointer.seen || this.pointer.away > 1.2);
      if (this.pointer.seen && !this.pointer.inside) this.pointer.away += dt;

      let px = this.pointer.seen ? this.pointer.x : 0;
      let py = this.pointer.seen ? this.pointer.y : 0;

      if (wandering) {
        const amount = Math.min(this.field.width, this.field.height) * 0.32;
        px = Math.cos(this.clock * 0.37) * amount + Math.sin(this.clock * 0.21) * amount * 0.35;
        py = Math.sin(this.clock * 0.53 + 1.3) * amount * 0.8;
      }

      const follow = 1 - Math.exp(-dt / (this.pointer.seen && !wandering ? 0.035 : 0.6));
      this.target.x += (px - this.target.x) * follow;
      this.target.y += (py - this.target.y) * follow;

      const speed = Math.hypot(this.pointer.vx, this.pointer.vy);
      if (speed > 40) {
        const turn = wrap(Math.atan2(this.pointer.vy, this.pointer.vx) - this.target.heading, TAU);
        this.target.heading += turn * (1 - Math.exp(-dt / 0.25));
      }
      this.pointer.vx *= Math.exp(-dt / 0.12);
      this.pointer.vy *= Math.exp(-dt / 0.12);

      if (this.introLive && this.introStart < 0) this.introStart = this.clock;
      const introTime = this.introLive ? this.clock - this.introStart : Infinity;
      let introBusy = false;

      const stiffness = s.inertia <= 0 || reduced ? 0 : Math.pow(6 + 42 * Math.pow(1 - s.inertia, 2), 2);
      const damping = stiffness ? 2 * Math.sqrt(stiffness) * (1 - 0.75 * s.bounce) : 0;
      const steps = stiffness ? Math.max(1, Math.ceil(dt / (1 / 240))) : 0;
      const h = steps ? dt / steps : 0;
      const lag = reduced ? 0 : s.ripple / 900;
      const radius = s.radius;
      const reachIn = s.reach * 0.55;
      const reachOut = s.reach;

      for (let i = this.pulses.length - 1; i >= 0; i--) {
        const age = this.clock - this.pulses[i].start;
        if (age > this.pulses[i].life) this.pulses.splice(i, 1);
      }

      let moving = false;
      for (let i = 0; i < this.count; i++) {
        const cx = this.centers[i * 2];
        const cy = this.centers[i * 2 + 1];
        const born = this.pending[i] === 1;
        if (born) {
          this.seenX[i] = this.target.x;
          this.seenY[i] = this.target.y;
        } else {
          const distance = Math.hypot(this.target.x - sx, this.target.y - sy);
          const tau = lag * distance;
          const k = tau > 0 ? 1 - Math.exp(-dt / tau) : 1;
          this.seenX[i] += (this.target.x - this.seenX[i]) * k;
          this.seenY[i] += (this.target.y - this.seenY[i]) * k;
          if (Math.abs(this.target.x - this.seenX[i]) + Math.abs(this.target.y - this.seenY[i]) > 0.05) moving = true;
        }
        const sx = this.seenX[i];
        const sy = this.seenY[i];
        const near = Math.hypot(sx - cx, sy - cy);
        let goal = this.fieldAngle(s, i, sx, sy);
        const rest = this.rests[i];
        if (reachOut > 0) {
          const t = clamp((reachOut - near) / Math.max(1, reachOut - reachIn), 0, 1);
          goal = rest + wrap(goal - rest, period) * smootherstep(t);
        }
        let shown = 1;
        if (this.introLive) {
          const local = (introTime - this.reveal[i] / this.field.introSpeed) / INTRO_SPIN;
          const progress = smootherstep(clamp(local, 0, 1));
          if (local < 1) introBusy = true;
          goal = rest + wrap(goal - rest, period) * progress;
          shown = clamp(local * 2.5, 0, 1);
        }
        if (born) {
          this.angles[i] = this.introLive ? rest : goal;
          this.speeds[i] = 0;
          this.pending[i] = 0;
        } else if (!stiffness) {
          this.angles[i] = this.angles[i] + wrap(goal - this.angles[i], period);
          this.speeds[i] = 0;
        } else {
          let angle = this.angles[i];
          let velocity = this.speeds[i];
          for (let step = 0; step < steps; step++) {
            velocity += (stiffness * wrap(goal - angle, period) - damping * velocity) * h;
            angle += velocity * h;
          }
          if (Math.abs(velocity) < 0.002 && Math.abs(wrap(goal - angle, period)) < 0.0005) {
            angle += wrap(goal - angle, period);
            velocity = 0;
          } else moving = true;
          if (angle > 40 || angle < -40) angle = wrap(angle, TAU);
          this.angles[i] = angle;
          this.speeds[i] = velocity;
        }

        let spin = 0;
        let flash = 0;
        for (const pulse of this.pulses) {
          const travelled = (this.clock - pulse.start) * PULSE_SPEED;
          const gap = Math.hypot(cx - pulse.x, cy - pulse.y);
          const local = (travelled - gap) / (PULSE_SPEED * PULSE_SPIN);
          if (local > 0 && local < 1) spin += smootherstep(local) * period;
          const band = (travelled - gap - PULSE_SPEED * PULSE_SPIN * 0.5) / 60;
          flash += Math.exp(-band * band) * Math.max(0, 1 - (this.clock - pulse.start) / pulse.life);
        }

        const emphasis = Math.exp(-(near * near) / (radius * radius)) * shown;
        this.state[i * 4] = this.angles[i] + spin;
        this.state[i * 4 + 1] = emphasis;
        this.state[i * 4 + 2] = Math.min(1, flash * 0.9) * shown;
        this.state[i * 4 + 3] = shown;
      }

      if (this.introLive && !introBusy && this.clock - this.introStart > 0.2) this.introLive = false;
      if (Math.abs(px - this.target.x) + Math.abs(py - this.target.y) > 0.05) moving = true;

      const gl = this.gl;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      if (this.count && this.field.view) {
        const u = this.uniforms;
        gl.useProgram(this.program);
        gl.uniformMatrix3fv(u.uView, true, this.field.view.forward);
        gl.uniform2f(u.uCanvas, this.field.width + field.pad * 2, this.field.height + field.pad * 2);
        gl.uniform2f(u.uOffset, field.pad, field.pad);
        gl.uniform2f(u.uLine, field.length / 2, field.thickness / 2);
        gl.uniform1f(u.uStretch, s.stretch);
        gl.uniform1f(u.uHead, s.shape === 'needle' ? 0.16 : s.shape === 'arrow' ? 0.32 : 0);
        gl.uniform1f(u.uPad, field.edgePad);
        gl.uniform1f(u.uFar, field.fill ? FAR : 1e6);
        gl.uniform3fv(u.uColor, s.color);
        gl.uniform3fv(u.uAccent, s.accent);
        gl.uniform1f(u.uAccentMix, s.accentMix);
        gl.uniform1f(u.uOpacity, 1);
        gl.uniform1f(u.uFade, s.fade);
        gl.uniform1i(u.uShape, SHAPES[s.shape]);
        gl.uniform1f(u.uRainbow, s.rainbow ? 1 : 0);
        gl.uniform1f(u.uTone, s.tone);
        gl.uniform1f(u.uPeriod, period);
        gl.uniform2f(u.uPixels, this.canvas.width, this.canvas.height);
        gl.uniform2f(u.uEdge, s.edgeFade * 0.34 * field.width, s.edgeFade * 0.44 * field.height);
        gl.bindVertexArray(this.vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.stateBuffer);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.state);
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.count);
      }

      const busy = moving || this.introLive || this.pulses.length > 0 || wandering;
      if (busy && this.visible && this.pageVisible) {
        this.raf = requestAnimationFrame(() => this.frame(now));
      }
    }

    destroy() {
      cancelAnimationFrame(this.raf);
      if (this.resizeObserver) this.resizeObserver.disconnect();
      if (this.intersectionObserver) this.intersectionObserver.disconnect();
      window.removeEventListener('pointermove', this.onPointerMove);
      window.removeEventListener('pointerdown', this.onPointerDown);
      document.documentElement.removeEventListener('pointerleave', this.onLeave);
      document.removeEventListener('visibilitychange', this.onVisibility);
      window.removeEventListener('resize', this.onResize);
      if (this.gl && this.program) {
        this.gl.deleteBuffer(this.cornerBuffer);
        this.gl.deleteBuffer(this.centerBuffer);
        this.gl.deleteBuffer(this.stateBuffer);
        this.gl.deleteVertexArray(this.vao);
        this.gl.deleteProgram(this.program);
      }
    }
  }

  // Auto-initialize on elements with data-magnet-lines attribute
  document.addEventListener('DOMContentLoaded', () => {
    const containers = document.querySelectorAll('[data-magnet-lines]');
    containers.forEach(container => {
      const options = {};
      for (const attr of container.attributes) {
        if (attr.name.startsWith('data-magnet-')) {
          const key = attr.name.replace('data-magnet-', '').replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
          let value = attr.value;
          try { value = JSON.parse(value); } catch {}
          options[key] = value;
        }
      }
      new MagnetLines(container, options);
    });
  });

  // Export for module systems
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = MagnetLines;
  } else if (typeof window !== 'undefined') {
    window.MagnetLines = MagnetLines;
  }
})();