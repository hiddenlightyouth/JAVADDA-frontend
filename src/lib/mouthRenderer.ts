import type { MouthPose } from './lipsync'

/**
 * 면접관 사진의 입과 턱을 실제로 움직여요. 위에 입 그림을 덧그리지 않고 화면의 픽셀마다 사진의 어느 자리를 읽을지 바꿔요.
 * 입술 주변만 작게 움직이고 벌어진 틈에 입안을 그려요. 눈, 턱 외곽, 목은 변형하지 않아요.
 * 숫자는 모두 `public/images/interviewer-balanced.png`(1254px)의 자리라서, 사진을 바꾸면 같이 재요.
 */

export const PORTRAIT_URL = '/images/interviewer-balanced.png'
export const PORTRAIT_SIZE = 1254
/** 사진에서 보여줄 정사각형이에요. 입이 잘 보이게 얼굴 쪽으로 당겨요. CSS의 배경 자리와 같아야 해요. */
export const PORTRAIT_WINDOW = { x: 188, y: 40, size: 860 }

const VERTEX = `#version 300 es
out vec2 vUv;
void main() {
  vec2 corner = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vUv = vec2(corner.x, 1.0 - corner.y);
  gl_Position = vec4(corner * 2.0 - 1.0, 0.0, 1.0);
}`

const FRAGMENT = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 color;
uniform sampler2D uPortrait;
uniform vec3 uWindow;
uniform float uOpen, uWide, uRound, uEdge, uLod;

const float SIZE = ${PORTRAIT_SIZE.toFixed(1)};
// 정면 보정된 사진의 입꼬리(538, 618), (698, 618)를 기준으로 해요.
const vec2 CENTER = vec2(618.0, 618.0);
const vec2 ALONG = vec2(1.0, 0.0);
const vec2 DOWN = vec2(0.0, 1.0);
const float HALF = 80.0;

vec3 portrait(vec2 at) {
  return textureLod(uPortrait, at / SIZE, uLod).rgb;
}

// 벌어진 틈 안이에요. 위에서 아래로 깊이가 바뀌고, 윗니와 혀가 있어요.
vec3 inside(float s, float t, float top, float bottom) {
  float height = max(bottom - top, 1.0);
  vec3 tint = mix(vec3(0.13, 0.04, 0.05), vec3(0.27, 0.09, 0.11), (t - top) / height);
  float tongue = 1.0 - smoothstep(0.8, 1.05, length(vec2(s / 0.62, (t - bottom - height * 0.08) / (height * 0.5))));
  tint = mix(tint, vec3(0.66, 0.34, 0.37), tongue * smoothstep(10.0, 24.0, height));
  float teethEnd = top + min(height * 0.42, 16.0);
  float teeth = (1.0 - smoothstep(teethEnd - uEdge, teethEnd + uEdge, t)) * smoothstep(5.0, 13.0, height) * (1.0 - smoothstep(0.62, 0.86, abs(s)));
  vec3 tooth = vec3(0.84, 0.8, 0.76) * mix(0.55, 1.0, smoothstep(0.0, 7.0, t - top));
  tint = mix(tint, tooth, teeth);
  return tint * mix(0.45, 1.0, 1.0 - smoothstep(0.55, 1.0, abs(s)));
}

void main() {
  vec2 pixel = uWindow.xy + vUv * uWindow.z;
  vec2 fromCenter = pixel - CENTER;
  float x = dot(fromCenter, ALONG);
  float t = dot(fromCenter, DOWN);

  // 입꼬리를 옆으로 당기거나 가운데로 모아요. 입에서 멀어질수록 힘이 줄어요.
  float width = 1.0 + 0.09 * uWide - 0.16 * uRound;
  // 코끝은 입에서 50px 위라서, 그 아래에서 힘을 없애요. 없애지 않으면 말할 때 콧볼이 입 모양을 따라 넓어지고 좁아져요.
  float belowNose = smoothstep(-42.0, -24.0, t);
  float reach = (1.0 - smoothstep(0.85, 1.7, length(vec2(x, t * 1.15)) / HALF)) * belowNose;
  float sourceX = x * mix(1.0, 1.0 / width, reach);
  float s = sourceX / HALF;

  float inner = max(0.0, 1.0 - s * s);
  float lipLine = inner * 6.0;
  float shape = pow(inner, mix(0.75, 0.5, uRound));
  float lift = (5.0 + 3.0 * uRound) * uOpen;
  float drop = 30.0 * uOpen;
  float top = lipLine - lift * shape;
  float bottom = lipLine + drop * shape;

  // 입 아래의 변형을 턱선에 닿기 전에 부드럽게 없애요.
  // 턱을 잘라 목 위에 덮는 방식은 이중 윤곽과 좌우 비대칭을 만들어요.
  float lowerWeight = 1.0 - smoothstep(28.0, 112.0, t - lipLine);
  float lowerT = t - drop * shape * lowerWeight;
  float upperT = t + lift * shape * (1.0 - smoothstep(0.0, 30.0, top - t));
  bool lower = t > (top + bottom) * 0.5;
  vec2 source = CENTER + ALONG * sourceX + DOWN * (lower ? lowerT : upperT);
  vec3 face = portrait(source);

  float gap = smoothstep(top - uEdge, top + uEdge, t) * (1.0 - smoothstep(bottom - uEdge, bottom + uEdge, t));
  gap *= smoothstep(0.1, 1.2, bottom - top);
  color = vec4(mix(face, inside(s, t, top, bottom), gap), 1.0);
}`

export interface MouthRenderer {
  resize: (cssWidth: number) => void
  draw: (pose: MouthPose) => void
  dispose: () => void
}

const clamp = (value: number) => Math.max(0, Math.min(1, value))

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  return shader
}

/** 사진을 그릴 준비를 해요. WebGL2를 쓸 수 없으면 null이고, 그때 화면은 움직이지 않는 사진이에요. */
export function createMouthRenderer(canvas: HTMLCanvasElement, image: HTMLImageElement): MouthRenderer | null {
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, powerPreference: 'low-power' })
  if (!gl) return null
  const program = gl.createProgram()
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX)
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT)
  if (!program || !vertex || !fragment) return null
  gl.attachShader(program, vertex)
  gl.attachShader(program, fragment)
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null
  gl.useProgram(program)

  gl.bindTexture(gl.TEXTURE_2D, gl.createTexture())
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
  gl.generateMipmap(gl.TEXTURE_2D)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

  gl.bindVertexArray(gl.createVertexArray())
  const uniform = (name: string) => gl.getUniformLocation(program, name)
  const open = uniform('uOpen')
  const wide = uniform('uWide')
  const round = uniform('uRound')
  const edge = uniform('uEdge')
  const lod = uniform('uLod')
  gl.uniform3f(uniform('uWindow'), PORTRAIT_WINDOW.x, PORTRAIT_WINDOW.y, PORTRAIT_WINDOW.size)

  return {
    resize(cssWidth) {
      const size = Math.max(1, Math.round(cssWidth * Math.min(2, window.devicePixelRatio || 1)))
      canvas.width = size
      canvas.height = size
      gl.viewport(0, 0, size, size)
      const scale = PORTRAIT_WINDOW.size / size
      gl.uniform1f(edge, scale * 0.75)
      gl.uniform1f(lod, Math.max(0, Math.log2(scale)))
    },
    draw(pose) {
      gl.uniform1f(open, clamp(pose.open))
      gl.uniform1f(wide, clamp(pose.wide))
      gl.uniform1f(round, clamp(pose.round))
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    },
    dispose() {
      // 질문마다 새로 그려서, 놓아주지 않으면 브라우저의 WebGL 개수 제한에 걸려요.
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    },
  }
}
