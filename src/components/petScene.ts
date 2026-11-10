import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import type { PetKind } from '../lib/pet'

// 펫을 three.js로 그려요. pixel-reels(scene.js)의 makeBot과 FACES를 펫 하나만 그리게 옮겼어요.
// 펫을 켰을 때만 이 파일과 three.js를 받아요.

export type PetMood = 'idle' | 'dance' | 'happy' | 'error' | 'talk'

/** 춤의 빠르기(1초에 몇 박)예요. 네 박마다 다음 동작으로 넘어가요. */
const BEAT = 2.4
/** 끌려갈 때 흔들리는 진자의 세기예요. */
const SWING_SPRING = 38
const SWING_DAMP_HELD = 2.6
const SWING_DAMP_FREE = 9
const SWING_PULL = 0.05
const SWING_MAX = 0.75
const SWING_MAX_SPEED = 9
const GRAB_LIFT = 0.07
/** 통통 뛰기, 옆으로 스텝, 두 팔 흔들기, 회전 점프를 차례로 춰요. */
const MOVES = ['bounce', 'shuffle', 'wave', 'spin'] as const
type FaceStyle = 'normal' | 'dry' | 'soft' | 'happy' | 'curious' | 'angry' | 'dizzy'

interface BotDef {
  color: string
  body: [number, number, number]
  legs: number
  face: 'clawd' | 'chibi'
  rough?: number
  chibi?: boolean
  emblem?: string
}

/** 이 파일이 그리는 펫이에요. 잡아따 도마뱀은 `geckoScene.ts`가 그려요. */
export type BotKind = Exclude<PetKind, 'javadda'>

const BOTS: Record<BotKind, BotDef> = {
  claude: { color: '#e0683c', body: [0.4, 0.28, 0.27], legs: 4, face: 'clawd' },
  codex: { color: '#ece9e1', body: [0.32, 0.42, 0.26], legs: 2, face: 'chibi', rough: 0.32, chibi: true, emblem: '>_' },
}

const BOT_LEG = 0.075
type Ctx = CanvasRenderingContext2D

function pill(g: Ctx, x: number, y: number, w: number, h: number) {
  g.beginPath()
  g.roundRect(x - w / 2, y - h / 2, w, h, Math.min(w, h) / 2)
  g.fill()
}

/** Claude: 세로로 긴 검은 눈 두 개 */
function clawd(g: Ctx, w: number, h: number, def: BotDef, style: FaceStyle, open: number, blink: boolean) {
  g.fillStyle = def.color
  g.fillRect(0, 0, w, h)
  g.fillStyle = '#140b0c'
  g.strokeStyle = '#140b0c'
  const ew = 34
  const cy = 128 - open * 6
  for (const x of [w * 0.345, w * 0.655]) {
    if (blink) {
      g.fillRect(x - ew / 2 - 4, cy + 34, ew + 8, 12)
      continue
    }
    if (style === 'happy') {
      g.lineWidth = 20
      g.lineJoin = 'miter'
      g.beginPath()
      g.moveTo(x - 30, cy + 26)
      g.lineTo(x, cy - 10)
      g.lineTo(x + 30, cy + 26)
      g.stroke()
    } else if (style === 'dry') g.fillRect(x - ew / 2 - 2, cy + 6, ew + 4, 44)
    else if (style === 'soft') g.fillRect(x - ew / 2, cy - 30, ew, 80)
    else if (style === 'curious') g.fillRect(x - ew / 2 - 5, cy - 58, ew + 10, 116)
    else if (style === 'dizzy') {
      g.lineWidth = 14
      g.beginPath()
      g.moveTo(x - 26, cy - 26)
      g.lineTo(x + 26, cy + 26)
      g.moveTo(x + 26, cy - 26)
      g.lineTo(x - 26, cy + 26)
      g.stroke()
    } else g.fillRect(x - ew / 2, cy - 46, ew, 96)
  }
}

/** Codex: 어두운 화면에 민트색으로 빛나는 눈과 점선 입 */
function chibi(g: Ctx, w: number, h: number, _def: BotDef, style: FaceStyle, open: number, blink: boolean) {
  g.fillStyle = '#11151d'
  g.fillRect(0, 0, w, h)
  const glow = '#8ff5cf'
  g.save()
  g.shadowColor = glow
  g.shadowBlur = 26
  g.fillStyle = glow
  g.strokeStyle = glow
  g.lineCap = 'round'
  g.lineJoin = 'round'
  const cy = h * 0.42 - open * 6
  const lx = w * 0.32
  const rx = w * 0.68
  const chevron = (x: number, y: number) => {
    g.lineWidth = 17
    g.beginPath()
    g.moveTo(x - 30, y + 20)
    g.lineTo(x, y - 16)
    g.lineTo(x + 30, y + 20)
    g.stroke()
  }
  if (blink) {
    pill(g, lx, cy + 8, 58, 14)
    pill(g, rx, cy + 8, 58, 14)
  } else if (style === 'happy') {
    chevron(lx, cy)
    chevron(rx, cy)
  } else if (style === 'dry') {
    pill(g, lx, cy + 6, 66, 16)
    pill(g, rx, cy + 6, 66, 16)
  } else if (style === 'soft') {
    pill(g, lx, cy + 6, 40, 48)
    pill(g, rx, cy + 6, 40, 48)
  } else if (style === 'curious') {
    g.beginPath()
    g.arc(lx, cy, 30, 0, 7)
    g.arc(rx, cy, 30, 0, 7)
    g.fill()
  } else if (style === 'dizzy') {
    g.lineWidth = 14
    for (const x of [lx, rx]) {
      g.beginPath()
      g.moveTo(x - 24, cy - 24)
      g.lineTo(x + 24, cy + 24)
      g.moveTo(x + 24, cy - 24)
      g.lineTo(x - 24, cy + 24)
      g.stroke()
    }
  } else {
    pill(g, lx, cy, 40, 74)
    pill(g, rx, cy, 40, 74)
  }
  const my = h * 0.74
  if (open > 0.12) pill(g, w / 2, my, 70, 10 + open * 34)
  else for (let i = -2; i <= 2; i++) g.fillRect(w / 2 + i * 15 - 5, my - 4, 10, 8)
  g.restore()
}

const FACES = { clawd, chibi }

function mesh(geo: THREE.BufferGeometry, material: THREE.Material | THREE.Material[], parent: THREE.Object3D, pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1]) {
  const m = new THREE.Mesh(geo, material)
  m.position.set(pos[0], pos[1], pos[2])
  m.rotation.set(rot[0], rot[1], rot[2])
  m.scale.set(scale[0], scale[1], scale[2])
  parent.add(m)
  return m
}

function makeBot(def: BotDef) {
  const root = new THREE.Group()
  const body = new THREE.Group()
  body.position.y = BOT_LEG
  root.add(body)
  const [bw, bh, bd] = def.body
  const SCR: [number, number] = def.chibi ? [0.19, 0.13] : [bw, bh]
  const canvas = document.createElement('canvas')
  canvas.height = 280
  canvas.width = Math.round((280 * SCR[0]) / SCR[1])
  const fg = canvas.getContext('2d')!
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  let arms: THREE.Group[] = []

  if (def.chibi) {
    const shell = new THREE.MeshStandardMaterial({ color: def.color, roughness: def.rough ?? 0.4 })
    const inner = new THREE.Group()
    inner.scale.setScalar(0.85)
    body.add(inner)
    const head = new THREE.Group()
    head.position.y = 0.255
    inner.add(head)
    mesh(new THREE.SphereGeometry(0.14, 48, 32), shell, head, [0, 0, 0], [0, 0, 0], [1.32, 1.05, 0.86])
    for (const [x, y, z, r] of [
      [-0.1, 0.085, 0.035, 0.075], [0.1, 0.09, 0.03, 0.08], [0, 0.115, 0.02, 0.075], [-0.165, 0.0, 0.02, 0.06], [0.165, -0.005, 0.02, 0.06],
      [-0.07, 0.12, -0.05, 0.08], [0.08, 0.125, -0.06, 0.085], [0, 0.03, -0.09, 0.11],
    ])
      mesh(new THREE.SphereGeometry(r, 32, 24), shell, head, [x, y, z])
    const faceZ = 0.124
    mesh(new RoundedBoxGeometry(SCR[0] + 0.024, SCR[1] + 0.024, 0.03, 4, 0.01), new THREE.MeshStandardMaterial({ color: '#232836', roughness: 0.3 }), head, [0, -0.005, faceZ])
    const face = new THREE.Mesh(new THREE.PlaneGeometry(...SCR), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }))
    face.position.set(0, -0.005, faceZ + 0.0155)
    head.add(face)
    mesh(new THREE.SphereGeometry(0.085, 40, 28), shell, inner, [0, 0.085, 0], [0, 0, 0], [1.0, 0.95, 0.85])
    if (def.emblem) {
      const cc = document.createElement('canvas')
      cc.width = 128
      cc.height = 72
      const cg = cc.getContext('2d')!
      cg.font = 'bold 58px Menlo, monospace'
      cg.textAlign = 'center'
      cg.textBaseline = 'middle'
      cg.shadowColor = '#8ff5cf'
      cg.shadowBlur = 12
      cg.fillStyle = '#8ff5cf'
      cg.fillText(def.emblem, 64, 38)
      const ct = new THREE.CanvasTexture(cc)
      ct.colorSpace = THREE.SRGBColorSpace
      const chest = new THREE.Mesh(new THREE.PlaneGeometry(0.075, 0.042), new THREE.MeshBasicMaterial({ map: ct, transparent: true, toneMapped: false }))
      chest.position.set(0, 0.09, 0.0735)
      inner.add(chest)
    }
    arms = [-1, 1].map((s) => {
      const arm = new THREE.Group()
      arm.position.set(s * 0.08, 0.11, 0.005)
      inner.add(arm)
      mesh(new THREE.CapsuleGeometry(0.027, 0.045, 8, 16), shell, arm, [s * 0.03, -0.02, 0], [0, 0, s * 1.0])
      return arm
    })
    for (const x of [-0.038, 0.038]) mesh(new THREE.CapsuleGeometry(0.032, 0.035, 8, 16), shell, root, [x, 0.045, 0.005])
  } else {
    const m = new THREE.MeshStandardMaterial({ color: def.color, roughness: def.rough ?? 0.75 })
    const faceMat = new THREE.MeshStandardMaterial({ map: tex, roughness: def.rough ?? 0.75 })
    mesh(new THREE.BoxGeometry(bw, bh, bd), [m, m, m, m, faceMat, m], body, [0, bh / 2, 0])
    arms = [-1, 1].map((s) => {
      const arm = new THREE.Group()
      arm.position.set((s * bw) / 2, bh * 0.42, 0.02)
      body.add(arm)
      mesh(new THREE.BoxGeometry(0.075, 0.06, 0.085), m, arm, [s * 0.0375, 0, 0])
      return arm
    })
    for (let i = 0; i < def.legs; i++) mesh(new THREE.BoxGeometry(0.05, BOT_LEG + 0.01, 0.06), m, root, [-0.135 + i * 0.09, BOT_LEG / 2, 0.02])
  }

  return {
    root,
    body,
    arms,
    height: def.chibi ? 0.47 : BOT_LEG + bh,
    draw(style: FaceStyle, open: number, blink: boolean) {
      FACES[def.face](fg, canvas.width, canvas.height, def, style, open, blink)
      tex.needsUpdate = true
    },
  }
}

const ease = (x: number) => x * x * (3 - 2 * x)

/** 펫 하나를 canvas에 그려요. setMood로 기분을, look으로 바라볼 쪽(-1에서 1)을 바꾸고, hop으로 한 바퀴 뛰어요. */
export function createPetScene(canvas: HTMLCanvasElement, kind: BotKind, still: boolean) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.setClearColor(0x000000, 0)

  const scene = new THREE.Scene()
  scene.add(new THREE.HemisphereLight('#ffffff', '#b9b3c9', 1.6))
  const key = new THREE.DirectionalLight('#ffffff', 1.8)
  key.position.set(0.8, 1.6, 2)
  scene.add(key)
  const rim = new THREE.DirectionalLight('#fff1e0', 0.6)
  rim.position.set(-1.5, 1, -1)
  scene.add(rim)

  const bot = makeBot(BOTS[kind])
  scene.add(bot.root)
  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 10)
  const target = new THREE.Vector3(0, bot.height * 0.5 + 0.04, 0)
  camera.position.set(0, target.y + 0.28, 1.65)
  camera.lookAt(target)

  const BASE_YAW = 0.32
  let mood: PetMood = 'idle'
  let lookX = 0
  let yaw = BASE_YAW
  let hopStart = -10
  let nextBlink = 1.5
  let blinkUntil = 0
  let faceKey = ''
  let frame = 0
  let last = 0
  // 끌려갈 때: 머리 위를 잡힌 채 매달려서, 끄는 쪽 반대로 흔들리는 진자예요.
  let grabbed = false
  let releaseAt = -10
  let swing = 0
  let swingSpeed = 0
  let lift = 0
  // three.js의 Clock은 그만 쓰라는 경고가 떠서, 켠 뒤 흐른 시간(초)만 재는 작은 시계로 대신해요
  const startedAt = performance.now()
  const clock = { getElapsedTime: () => (performance.now() - startedAt) / 1000 }

  const resize = () => {
    const w = canvas.clientWidth || 1
    const h = canvas.clientHeight || 1
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  resize()

  const styleOf = (t: number): FaceStyle => {
    // 잡혀 있으면 놀란 눈, 세게 흔들리면 어지러운 눈이에요.
    if (grabbed) return Math.abs(swingSpeed) > 4 ? 'dizzy' : 'curious'
    if (t - hopStart < 1.1) return 'happy'
    if (mood === 'happy') return 'happy'
    if (mood === 'error') return 'dizzy'
    // 춤추는 동안은 박자마다 웃는 눈, 보통 눈, 동그란 눈을 오가요.
    if (mood === 'dance') {
      const move = MOVES[Math.floor((t * BEAT) / 4) % MOVES.length]
      if (move === 'shuffle') return Math.floor(t * BEAT) % 2 ? 'normal' : 'happy'
      if (move === 'spin') return (t * BEAT) % 4 > 3 ? 'curious' : 'happy'
      return 'happy'
    }
    return 'normal'
  }

  const render = () => {
    const t = clock.getElapsedTime()
    const dt = Math.min(0.05, t - last)
    last = t

    // 깜빡이기
    if (t > nextBlink) {
      blinkUntil = t + 0.12
      nextBlink = t + 2.5 + Math.random() * 3
    }
    const blink = t < blinkUntil && mood !== 'error' && !grabbed
    const talking = mood === 'talk' || mood === 'happy'
    const open = talking && !still ? Math.max(0, Math.sin(t * 14)) * 0.8 : 0
    const style = styleOf(t)
    const k = `${style}|${blink}|${open.toFixed(2)}`
    if (k !== faceKey) {
      faceKey = k
      bot.draw(style, open, blink)
    }

    // 바라보기: 마우스가 있는 쪽으로 천천히 돌아요.
    const wantYaw = grabbed ? lookX * 0.3 : BASE_YAW + lookX * 0.55 + (mood === 'idle' && !still ? Math.sin(t * 0.35) * 0.12 : 0)
    yaw += (wantYaw - yaw) * Math.min(1, dt * 4)

    let y = 0
    let sy = 1
    let spin = 0
    let x = 0
    let tilt = 0
    let twist = 0
    let armLift: [number, number] = [0, 0]
    if (!still) {
      if (mood === 'dance') {
        const phase = t * BEAT
        const f = phase % 1
        const lift = Math.sin(f * Math.PI)
        const move = MOVES[Math.floor(phase / 4) % MOVES.length]
        const left = Math.max(0, Math.sin(phase * Math.PI + Math.PI))
        const right = Math.max(0, Math.sin(phase * Math.PI))
        if (move === 'bounce') {
          // 박자마다 크게 통통 뛰고 좌우로 흔들며 팔을 번갈아 뻗어요.
          y = lift * 0.06
          sy = 1 - (1 - lift) ** 3 * 0.14
          tilt = Math.sin(phase * Math.PI) * 0.22
          armLift = [left * 1.4, right * 1.4]
        } else if (move === 'shuffle') {
          // 옆으로 한 발씩 스텝을 밟으며 반대쪽으로 몸을 기울여요.
          x = Math.sin((phase * Math.PI) / 2) * 0.07
          y = lift * 0.025
          tilt = -Math.sin((phase * Math.PI) / 2) * 0.2
          twist = Math.sin((phase * Math.PI) / 2) * 0.6
          armLift = [0.8, 0.8]
        } else if (move === 'wave') {
          // 두 팔을 번쩍 들고 흔들며 위아래로 들썩여요.
          sy = 1 + Math.sin(phase * Math.PI * 2) * 0.07
          y = Math.abs(Math.sin(phase * Math.PI)) * 0.02
          twist = Math.sin(phase * Math.PI) * 0.35
          armLift = [1.5 + Math.sin(phase * Math.PI * 4) * 0.35, 1.5 - Math.sin(phase * Math.PI * 4) * 0.35]
        } else {
          // 세 박은 작게 뛰고, 마지막 박에 높이 뛰어 한 바퀴 돌아요.
          const beat = phase % 4
          if (beat < 3) {
            y = lift * 0.03
            sy = 1 - (1 - lift) ** 3 * 0.18
            armLift = [0.3, 0.3]
          } else {
            const p = beat - 3
            y = Math.sin(p * Math.PI) * 0.14
            sy = 1.08
            spin = ease(p) * Math.PI * 2
            armLift = [1.6, 1.6]
          }
        }
      } else if (mood === 'talk') {
        sy = 1 - Math.max(0, Math.sin(t * 14)) * 0.05
        y = Math.max(0, Math.sin(t * 7)) * 0.012
      } else if (mood === 'error') {
        tilt = Math.sin(t * 3) * 0.12
      } else {
        sy = 1 + Math.sin(t * 2.2) * 0.012
      }
      // 웅크렸다가 뛰어올라 한 바퀴 돌고 내려앉아요(scene.js의 hopAt).
      const h = t - hopStart
      if (h >= 0 && h < 1.0) {
        if (h < 0.18) sy = 1 - ease(h / 0.18) * 0.18
        else if (h < 0.78) {
          const p = (h - 0.18) / 0.6
          y = Math.sin(p * Math.PI) * 0.16
          sy = 1.06
          spin = ease(p) * Math.PI * 2
        } else {
          const p = (h - 0.78) / 0.22
          sy = 1 - Math.sin(p * Math.PI) * 0.12
        }
        armLift = [0, 0]
      }
    }
    if (!still) {
      swingSpeed += (-SWING_SPRING * swing - (grabbed ? SWING_DAMP_HELD : SWING_DAMP_FREE) * swingSpeed) * dt
      swingSpeed = Math.max(-SWING_MAX_SPEED, Math.min(SWING_MAX_SPEED, swingSpeed))
      swing = Math.max(-SWING_MAX, Math.min(SWING_MAX, swing + swingSpeed * dt))
      lift += ((grabbed ? GRAB_LIFT : 0) - lift) * Math.min(1, dt * (grabbed ? 16 : 12))
      if (grabbed) {
        // 머리 위를 축으로 매달려 흔들리고, 몸이 축 늘어지며 팔다리를 버둥거려요.
        const top = bot.height
        x = top * Math.sin(swing)
        y = lift + top * (1 - Math.cos(swing))
        tilt = swing
        twist = 0
        spin = 0
        sy = 1.07 + Math.sin(t * 9) * 0.015
        armLift = [0.5 + Math.sin(t * 17) * 0.45, 0.5 + Math.sin(t * 17 + 2) * 0.45]
      } else {
        // 놓으면 떨어져서 찌그러졌다가 펴지고, 남은 흔들림은 발을 축으로 잦아들어요.
        y += lift
        tilt += swing * 0.5
        const p = (t - releaseAt - 0.12) / 0.22
        if (p > 0 && p < 1) sy = Math.min(sy, 1 - Math.sin(p * Math.PI) * 0.16)
      }
    }
    bot.root.rotation.set(0, yaw + twist + spin, tilt)
    bot.root.position.set(x, y, 0)
    bot.body.scale.set(1 + (1 - sy) * 0.5, sy, 1 + (1 - sy) * 0.5)
    bot.arms.forEach((arm, i) => {
      const s = i ? 1 : -1
      arm.rotation.x = 0
      arm.rotation.z = grabbed ? s * armLift[i] : mood === 'happy' || t - hopStart < 1.0 ? s * 0.6 : mood === 'dance' ? s * (0.2 + armLift[i]) : 0
    })
    renderer.render(scene, camera)
  }

  const loop = () => {
    frame = requestAnimationFrame(loop)
    if (document.hidden) return
    render()
  }
  if (still) render()
  else loop()

  return {
    setMood(next: PetMood) {
      mood = next
      if (still) render()
    },
    look(x: number) {
      lookX = Math.max(-1, Math.min(1, x))
    },
    /** 잡거나 놓아요. */
    grab(on: boolean) {
      if (on === grabbed) return
      grabbed = on
      if (!on) releaseAt = clock.getElapsedTime()
      if (still) render()
    },
    /** 끌려간 거리(px)예요. 끄는 쪽 반대로 몸이 흔들려요. */
    pull(dx: number) {
      swingSpeed -= dx * SWING_PULL
    },
    hop() {
      hopStart = clock.getElapsedTime()
      if (still) render()
    },
    resize() {
      resize()
      render()
    },
    dispose() {
      cancelAnimationFrame(frame)
      scene.traverse((object) => {
        const m = object as THREE.Mesh
        if (!m.isMesh) return
        m.geometry.dispose()
        for (const material of Array.isArray(m.material) ? m.material : [m.material]) {
          ;(material as THREE.MeshStandardMaterial).map?.dispose()
          material.dispose()
        }
      })
      renderer.dispose()
    },
  }
}
