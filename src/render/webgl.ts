import type { Grid } from '../engine';
import { flipVertical, parseHexColor, unpremultiply, type RgbaData } from '../image/alpha';
import type { DrawOptions, MeshRenderer, View } from './types';

const VERT = `#version 300 es
precision highp float;
in vec2 aPos;
in vec2 aUV;
uniform vec2 uViewport;
uniform float uScale;
uniform vec2 uOffset;
out vec2 vUV;
void main() {
  vec2 px = aPos * uScale + uOffset;
  vec2 clip = vec2(px.x / uViewport.x * 2.0 - 1.0, 1.0 - px.y / uViewport.y * 2.0);
  gl_Position = vec4(clip, 0.0, 1.0);
  vUV = aUV;
}`;

const FRAG = `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uTex;
out vec4 outColor;
void main() {
  // The texture is stored premultiplied, so this is already the blend-ready value.
  outColor = texture(uTex, vUV);
}`;

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Could not create shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile failed: ${log}`);
  }
  return shader;
}

/**
 * Minimal WebGL2 mesh renderer.
 *
 * Works in premultiplied alpha end to end, which is what keeps deformed
 * silhouettes free of dark or bright fringes where the mesh folds over itself.
 * `readPixels` converts back to straight alpha for the export encoders.
 */
export class WebGLMeshRenderer implements MeshRenderer {
  readonly kind = 'webgl2' as const;
  readonly canvas: HTMLCanvasElement | OffscreenCanvas;

  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private posBuffer: WebGLBuffer;
  private uvBuffer: WebGLBuffer;
  private indexBuffer: WebGLBuffer;
  private texture: WebGLTexture;
  private uniforms: {
    viewport: WebGLUniformLocation;
    scale: WebGLUniformLocation;
    offset: WebGLUniformLocation;
    tex: WebGLUniformLocation;
  };
  private indexCount = 0;
  private uvVersion = -1;
  private indexVersion = -1;
  private posCapacity = 0;
  private lost = false;

  static isSupported(): boolean {
    if (typeof document === 'undefined') return false;
    try {
      const probe = document.createElement('canvas');
      return Boolean(probe.getContext('webgl2'));
    } catch {
      return false;
    }
  }

  constructor(canvas: HTMLCanvasElement | OffscreenCanvas, opts: { antialias?: boolean } = {}) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: true,
      // MSAA is deliberately off. On a shared-edge mesh every interior edge
      // would be antialiased from both sides and show up as a bright seam.
      // Callers supersample the drawing buffer instead.
      antialias: opts.antialias ?? false,
      preserveDrawingBuffer: true,
      desynchronized: false,
      powerPreference: 'high-performance',
    }) as WebGL2RenderingContext | null;
    if (!gl) throw new Error('WebGL2 is not available');
    this.gl = gl;

    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.lost = true;
    });
    canvas.addEventListener('webglcontextrestored', () => {
      this.lost = false;
    });

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    const program = gl.createProgram();
    if (!program) throw new Error('Could not create program');
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.bindAttribLocation(program, 0, 'aPos');
    gl.bindAttribLocation(program, 1, 'aUV');
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`Program link failed: ${gl.getProgramInfoLog(program)}`);
    }
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    this.program = program;

    this.uniforms = {
      viewport: gl.getUniformLocation(program, 'uViewport')!,
      scale: gl.getUniformLocation(program, 'uScale')!,
      offset: gl.getUniformLocation(program, 'uOffset')!,
      tex: gl.getUniformLocation(program, 'uTex')!,
    };

    this.vao = gl.createVertexArray()!;
    this.posBuffer = gl.createBuffer()!;
    this.uvBuffer = gl.createBuffer()!;
    this.indexBuffer = gl.createBuffer()!;
    this.texture = gl.createTexture()!;

    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    gl.bindVertexArray(null);

    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
  }

  get width(): number {
    return this.canvas.width;
  }

  get height(): number {
    return this.canvas.height;
  }

  resize(width: number, height: number): void {
    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));
    if (this.canvas.width !== w) this.canvas.width = w;
    if (this.canvas.height !== h) this.canvas.height = h;
  }

  setTexture(image: ImageData): void {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA8,
      image.width,
      image.height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array(image.data.buffer, image.data.byteOffset, image.data.byteLength),
    );
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  }

  draw(positions: Float32Array, grid: Grid, view: View, options: DrawOptions): void {
    const gl = this.gl;
    if (this.lost) return;

    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    if (options.background) {
      const { r, g, b } = parseHexColor(options.background);
      gl.clearColor(r / 255, g / 255, b / 255, 1);
    } else {
      gl.clearColor(0, 0, 0, 0);
    }
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.posBuffer);
    if (positions.length > this.posCapacity) {
      gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);
      this.posCapacity = positions.length;
    } else {
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, positions);
    }

    const geometryVersion = grid.count * 131 + grid.cols;
    if (this.uvVersion !== geometryVersion) {
      const uv = new Float32Array(grid.count * 2);
      for (let i = 0; i < grid.count; i++) {
        uv[i * 2] = grid.u[i];
        uv[i * 2 + 1] = grid.v[i];
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, this.uvBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, uv, gl.STATIC_DRAW);
      this.uvVersion = geometryVersion;
    }
    if (this.indexVersion !== geometryVersion) {
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, grid.indices, gl.STATIC_DRAW);
      this.indexVersion = geometryVersion;
      this.indexCount = grid.indices.length;
    }

    gl.uniform2f(this.uniforms.viewport, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.uniforms.scale, view.scale);
    gl.uniform2f(this.uniforms.offset, view.offsetX, view.offsetY);
    gl.uniform1i(this.uniforms.tex, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);

    gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_INT, 0);
    gl.bindVertexArray(null);
  }

  readPixels(): RgbaData {
    const gl = this.gl;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const buffer = new Uint8ClampedArray(w * h * 4) as RgbaData;
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(buffer.buffer));
    flipVertical(buffer, w, h);
    unpremultiply(buffer);
    return buffer;
  }

  destroy(): void {
    const gl = this.gl;
    gl.deleteBuffer(this.posBuffer);
    gl.deleteBuffer(this.uvBuffer);
    gl.deleteBuffer(this.indexBuffer);
    gl.deleteTexture(this.texture);
    gl.deleteVertexArray(this.vao);
    gl.deleteProgram(this.program);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}
