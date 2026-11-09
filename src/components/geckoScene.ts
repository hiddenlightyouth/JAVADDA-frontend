import * as THREE from 'three'
import type { PetMood } from './petScene'

// 잡아따 도마뱀 펫을 three.js로 그려요. 블록을 쌓은 도마뱀이고, 자세마다 모양을 따로 쌓아 둬요(네 발, 앉기, 자기).
// 몸 색은 고른 테마의 메인 컬러를 따라가요(setColor). 펫을 켰을 때만 이 파일과 three.js를 받아요.

/** 블록 하나예요. 모서리 없는 상자라 붙여 쌓으면 이음선 없이 매끈한 덩어리로 보여요. */
const BLOCK = new THREE.BoxGeometry(1, 1, 1)
/** 꼬리가 끊긴 뒤 다시 자라기까지(초)예요. 그동안은 뭉툭한 꼬리 뿌리만 남은 채로 똑같이 지내요. */
const REGROW = 180
/** 아무 일 없이 이만큼(초) 지나면 잠들어요. */
const SLEEP_AFTER = 20
/** 들고 흔들 때 이만큼(초) 안에 방향을 네 번 넘게 바꾸면 꼬리가 빠져요. */
const SHAKE_WINDOW = 1.2
const SHAKE_FLIPS = 4
/** 이만큼(px) 넘게 끌려야 흔든 걸로 쳐요. */
const SHAKE_PX = 6

type Slot = 'body' | 'belly' | 'stripe' | 'eye' | 'shine'
type Part = 'body' | 'tail'
type FaceStyle = 'open' | 'blink' | 'happy' | 'wide' | 'annoyed'

interface Eye {
  left: [number, number]
  cells: [number, number][]
  shine?: [number, number]
  mirror?: boolean
  w?: number
}

/** 앞면 칸에 칠하는 눈이에요. 두 얼굴(네 발, 앉기)의 앞면은 x -4에서 4, y 8에서 15칸으로 좌표가 같아요. */
const EYES: Record<FaceStyle, Eye> = {
  // 세로로 긴 큰 눈(2x5)에 왼쪽 위 하이라이트
  open: { left: [-4, 3], cells: [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2], [0, 3], [1, 3], [0, 4], [1, 4]], shine: [0, 4] },
  blink: { left: [-4, 3], cells: [[0, 1], [1, 1]] },
  happy: { left: [-4, 2], cells: [[0, 1], [0, 2], [1, 3], [2, 2], [2, 1]] },
  wide: { left: [-4, 2], cells: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2], [0, 3], [1, 3], [2, 3]], shine: [0, 3] },
  // 들렸을 때: 가늘게 뜬 눈 위로 안쪽이 내려간 눈썹. 싫어하는 얼굴이에요
  annoyed: { left: [-4, 3], w: 2, cells: [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2], [0, 4], [1, 3]], mirror: true },
}
const QUESTION: [number, number][] = [[0, 4], [1, 4], [2, 4], [2, 3], [1, 2], [1, 0]]

function makeMaterials() {
  return {
    body: new THREE.MeshStandardMaterial({ roughness: 0.5 }),
    // 배와 줄무늬는 톤 매핑을 빼요. 밝은 하늘색이 톤 매핑을 거치면 흰색으로 바래서, 매달렸을 때 배가 뚫린 것처럼 보였어요
    belly: new THREE.MeshStandardMaterial({ roughness: 0.6, toneMapped: false }),
    stripe: new THREE.MeshStandardMaterial({ roughness: 0.6, toneMapped: false }),
    eye: new THREE.MeshStandardMaterial({ color: '#0b0d12', roughness: 0.2 }),
    shine: new THREE.MeshStandardMaterial({ color: '#d4d8e0', roughness: 0.3 }),
  } satisfies Record<Slot, THREE.MeshStandardMaterial>
}

/** 도마뱀을 쌓아요. 블록 한 칸이 1이고, +z가 얼굴 쪽, y가 위예요. */
function makeGecko(mats: ReturnType<typeof makeMaterials>) {
  const cube = (parent: THREE.Object3D, x: number, y: number, z: number, slot: Slot, part: Part = 'body') => {
    const m = new THREE.Mesh(BLOCK, mats[slot])
    m.position.set(x - parent.position.x, y - parent.position.y, z - parent.position.z)
    m.userData.part = part
    parent.add(m)
    return m
  }
  /** 속이 빈 상자. 겉면만 쌓고, 두 축 이상이 끝에 닿는 모서리 칸은 빼서 둥글게 해요. */
  const shell = (
    parent: THREE.Object3D,
    [x0, x1]: [number, number],
    [y0, y1]: [number, number],
    [z0, z1]: [number, number],
    paint: (x: number, y: number, z: number) => Slot,
    onFace?: (x: number, y: number, z: number, m: THREE.Mesh) => void,
  ) => {
    for (let x = x0; x <= x1; x++)
      for (let y = y0; y <= y1; y++)
        for (let z = z0; z <= z1; z++) {
          const ends = Number(x === x0 || x === x1) + Number(y === y0 || y === y1) + Number(z === z0 || z === z1)
          if (ends === 0 || ends >= 2) continue
          // 블록은 onFace가 없어도 늘 쌓아요. onFace?.(…, cube())로 쓰면 onFace가 없을 때 cube까지 건너뛰어요
          const m = cube(parent, x, y, z, paint(x, y, z))
          onFace?.(x, y, z, m)
        }
    // 깎은 모서리 안쪽을 메워서 구멍이 안 보이게 해요
    for (let x = x0 + 1; x < x1; x++)
      for (let y = y0 + 1; y < y1; y++)
        for (let z = z0 + 1; z < z1; z++) {
          const near = Number(x === x0 + 1 || x === x1 - 1) + Number(y === y0 + 1 || y === y1 - 1) + Number(z === z0 + 1 || z === z1 - 1)
          if (near >= 2) cube(parent, x, y, z, paint(x, y, z))
        }
  }

  // 네 발 모델: 돌아다니고, 달리고, 매달릴 때
  const walk = new THREE.Group()
  const head = new THREE.Group()
  head.position.set(0, 8, 3)
  const tail = new THREE.Group()
  tail.position.set(0, 5, -8.5)
  // 다리: 0 앞왼, 1 앞오른, 2 뒤왼, 3 뒤오른. 엉덩이를 축으로 흔들어요
  const LEG_AT: [number, number][] = [[-4.5, 1], [4.5, 1], [-4.5, -6], [4.5, -6]]
  const legs = LEG_AT.map(([x, z]) => {
    const g = new THREE.Group()
    g.position.set(x, 3, z + 0.5)
    return g
  })
  walk.add(head, tail, ...legs)
  // 몸통: 가로 7, 높이 5, 길이 11. 배와 가슴은 밝은 톤, 등에 줄무늬
  shell(walk, [-3, 3], [2, 6], [-8, 2], (x, y, z) => (y === 2 || (z === 2 && y <= 5) ? 'belly' : x === 0 && y === 6 ? 'stripe' : 'body'))
  // 머리: 가로 11, 높이 10, 깊이 8. 턱 밑은 하늘색, 정수리와 뒤통수에 줄무늬
  const walkFace = new Map<string, THREE.Mesh>()
  shell(
    head,
    [-5, 5],
    [7, 16],
    [3, 10],
    (x, y, z) => (y === 7 && z >= 6 && Math.abs(x) <= 3 ? 'belly' : x === 0 && (y === 16 || z === 3) ? 'stripe' : 'body'),
    (x, y, z, m) => {
      if (z === 10) walkFace.set(`${x},${y}`, m)
    },
  )
  // 이음매: 머리, 다리, 꼬리가 돌아가도 몸과 떨어져 보이지 않게 목, 어깨와 엉덩이, 꼬리 뿌리, 가슴을 덧대요
  for (let x = -2; x <= 2; x++) for (let y = 7; y <= 9; y++) for (let z = -1; z <= 2; z++) cube(walk, x, y, z, z === 2 ? 'belly' : 'body')
  for (const [lx, lz] of LEG_AT) for (let y = 3; y <= 5; y++) for (let z = lz; z <= lz + 1; z++) cube(walk, Math.sign(lx) * 4, y, z, 'body')
  for (let x = -1; x <= 1; x++) for (let y = 4; y <= 6; y++) cube(walk, x, y, -9, 'body')
  for (let x = -2; x <= 2; x++) for (let y = 2; y <= 6; y++) for (let z = 3; z <= 4; z++) cube(walk, x, y, z, z === 4 || y === 2 ? 'belly' : 'body')
  // 다리와 부채처럼 벌린 발가락 셋
  legs.forEach((g, i) => {
    const [lx, lz] = LEG_AT[i]
    for (const x of [lx - 0.5, lx + 0.5]) for (let y = 0; y <= 2; y++) for (let z = lz; z <= lz + 1; z++) cube(g, x, y, z, 'body')
    for (const dx of [-1, 0, 1]) cube(g, lx + dx * 0.95, 0, lz + 2.1 - Math.abs(dx) * 0.2, 'body').scale.set(0.85, 0.85, 1)
  })
  // 꼬리: 몸통만큼 길게 뒤로 뻗었다가 솟아올라 끝이 앞으로 말려요
  const TAIL: [number, number, number, number][] = [
    [4, 6, -9, 3], [4, 5, -10, 3], [4, 5, -11, 2], [5, 6, -12, 2], [5, 6, -13, 2], [6, 7, -14, 2], [7, 8, -15, 2],
    [8, 12, -16, 2], [12, 13, -15, 2], [13, 13, -14, 1], [12, 12, -13, 1], [11, 11, -13, 1],
  ]
  for (const [y0, y1, z, w] of TAIL)
    for (const x of w === 3 ? [-1, 0, 1] : w === 2 ? [-0.5, 0.5] : [0])
      for (let y = y0; y <= y1; y++) cube(tail, x, y, z, z === -16 && y % 2 === 0 && x > 0 ? 'stripe' : 'body', 'tail')

  // 앉은 모델: 가만히 있을 때. 아래가 넓은 몸통, 가슴 앞의 작은 앞발, 양옆으로 벌린 큰 뒷발, 옆으로 비스듬히 솟은 꼬리
  const sit = new THREE.Group()
  const sitHead = new THREE.Group()
  sitHead.position.set(0, 8, 0.5)
  const sitTail = new THREE.Group()
  sitTail.position.set(1.5, 1.5, -3.5)
  const arms = [-1, 1].map((s) => {
    const g = new THREE.Group()
    g.position.set(s * 3, 6.5, 0.5)
    return g
  })
  sit.add(sitHead, sitTail, ...arms)
  // 목 쪽 위층도 머리 아래를 받치게 넓혀서 턱 밑에 단차가 생기지 않아요
  const TORSO: [number, number, number, number, number, number][] = [[1, 3, 4, -3, 2, 3], [4, 5, 3, -3, 2, 2], [6, 7, 3, -2, 1, 2], [8, 8, 3, -2, 1, 2]]
  for (const [y0, y1, half, z0, z1, bellyHalf] of TORSO)
    for (let y = y0; y <= y1; y++)
      for (let x = -half; x <= half; x++)
        for (let z = z0; z <= z1; z++) {
          if (Number(Math.abs(x) === half) + Number(z === z0 || z === z1) >= 2 && y === y0 && y0 > 1) continue
          cube(sit, x, y, z, z === z1 && Math.abs(x) <= bellyHalf ? 'belly' : 'body')
        }
  for (const s of [-1, 1]) {
    for (let x = 2; x <= 5; x++)
      for (let y = 0; y <= 1; y++)
        for (let z = -1; z <= 2; z++) {
          if (y === 1 && (x === 5 || z === -1)) continue
          cube(sit, s * x, y, z, 'body')
        }
    for (const [dx, dz] of [[1.8, 3.1], [3, 3.3], [4.2, 3.1], [5.3, 2.6]]) cube(sit, s * dx, 0, dz, 'body').scale.set(0.9, 0.85, 1)
  }
  arms.forEach((g, i) => {
    const s = i ? 1 : -1
    cube(g, s * 3, 6, 0, 'body')
    cube(g, s * 3, 5, 1, 'body')
    cube(g, s * 2.6, 4.2, 2.2, 'body')
    for (const dx of [-0.45, 0.45]) cube(g, s * 2.4 + dx, 3.6, 2.8, 'body').scale.setScalar(0.6)
  })
  const sitFace = new Map<string, THREE.Mesh>()
  for (let x = -5; x <= 5; x++)
    for (let y = 8; y <= 16; y++)
      for (let z = -3; z <= 4; z++) {
        const ends = Number(Math.abs(x) === 5) + Number(z === -3 || z === 4) + Number(y === 8 || y === 16)
        if (ends >= 2) continue
        // 정수리는 두 단으로 깎아서 뚜껑을 얹은 것처럼 보이지 않고 둥글게 이어져요
        if (y === 16 && (Math.abs(x) >= 3 || z <= -1 || z >= 2)) continue
        if (y === 15 && (Math.abs(x) === 5 || z === -3 || z === 4)) continue
        if (Math.abs(x) < 4 && y > 9 && y < 15 && z > -2 && z < 3) continue
        const slot: Slot = y === 8 && z >= 1 && Math.abs(x) <= 3 ? 'belly' : x === 0 && ((y >= 15 && z <= 0) || z === -3) ? 'stripe' : 'body'
        const m = cube(sitHead, x, y, z, slot)
        if (z === 4) sitFace.set(`${x},${y}`, m)
      }
  // 꼬리가 끊겼을 때 남는 뭉툭한 꼬리 뿌리. 꼬리가 있을 땐 첫 마디와 겹쳐서 안 보여요
  for (const [x, y] of [[1, 1], [2, 1], [1, 2], [2, 2]]) cube(sit, x, y, -4, 'body')
  // 꼬리는 바닥을 따라 옆과 뒤로 길게 깔렸다가 끝만 들려요
  const SIT_TAIL: [number, number, number, number][] = [
    [1, 1, -4, 2], [2, 1, -5, 2], [3, 1, -6, 2], [4, 1, -6, 2], [5, 1, -6, 2], [6, 1, -6, 2], [7, 1, -6, 2], [8, 2, -6, 2],
    [9, 3, -6, 2], [10, 4, -5, 1], [10, 5, -5, 1], [11, 6, -5, 1], [11, 7, -5, 1],
  ]
  SIT_TAIL.forEach(([x, y, z, size], i) => {
    for (let dx = 0; dx < size; dx++)
      for (let dy = 0; dy < size; dy++)
        for (let dz = 0; dz < size; dz++) cube(sitTail, x + dx, y + dy, z - dz, dy === size - 1 && dx === size - 1 && i % 2 ? 'stripe' : 'body', 'tail')
  })
  const question = new THREE.Group()
  // 물음표는 몸 색이라 흰 바탕에서도 또렷해요
  for (const [x, y] of QUESTION) {
    const c = new THREE.Mesh(BLOCK, mats.body)
    c.position.set(x - 1, y, 0)
    question.add(c)
  }
  question.scale.setScalar(1.2)
  question.position.set(3.5, 9.5, 2)
  question.visible = false
  sitHead.add(question)

  // 자는 모델: 몸을 동그랗게 말고 엎드려서 긴 꼬리로 몸 앞을 감싸요. 머리는 왼쪽 앞 바닥에 기대고 눈은 감은 한 줄
  const sleep = new THREE.Group()
  for (let x = -5; x <= 5; x++)
    for (let z = -7; z <= 2; z++) {
      const d = Math.hypot((x + 0.5) / 5.5, (z + 2.5) / 5)
      if (d > 1) continue
      const h = Math.round(4.6 * Math.sqrt(1 - d * d))
      for (let y = 0; y <= h; y++) cube(sleep, x, y, z, x === 0 && y === h ? 'stripe' : 'body')
    }
  // 머리는 몸보다 작게, 몸 언덕 왼쪽 앞에 턱을 괴어요
  for (let x = -6; x <= 0; x++)
    for (let y = 0; y <= 5; y++)
      for (let z = 2; z <= 7; z++) {
        const ends = Number(x === -6 || x === 0) + Number(y === 0 || y === 5) + Number(z === 2 || z === 7)
        if (ends >= 2) continue
        if (x > -6 && x < 0 && y > 0 && y < 5 && z > 2 && z < 7) continue
        const eye = z === 7 && y === 3 && (x === -5 || x === -4 || x === -2 || x === -1)
        cube(sleep, x, y, z, eye ? 'eye' : y === 0 && z >= 4 && x >= -5 && x <= -1 ? 'belly' : 'body')
      }
  const sleepTail = new THREE.Group()
  sleep.add(sleepTail)
  // 꼬리는 몸 뒤에서 나와 오른쪽을 돌아 머리 앞까지 빙 감싸요
  const SLEEP_TAIL: [number, number, number][] = [[4, -7, 2], [5, -6, 2], [6, -4, 2], [6, -2, 2], [6, 0, 2], [5, 2, 2], [4, 4, 2], [3, 6, 2], [1, 8, 2], [-1, 8, 1], [-3, 9, 1], [-5, 9, 1]]
  SLEEP_TAIL.forEach(([x, z, size], i) => {
    for (let dx = 0; dx < size; dx++)
      for (let dz = 0; dz < size; dz++) for (let y = 0; y < size; y++) cube(sleepTail, x + dx, y, z + dz, y === size - 1 && i % 2 && dx === 0 ? 'stripe' : 'body', 'tail')
  })

  return { walk, head, tail, legs, walkFace, sit, sitHead, sitTail, arms, sitFace, question, sleep, sleepTail }
}

/** 펫 하나를 canvas에 그려요. petScene의 createPetScene과 같은 함수를 돌려줘서 PetStage가 그대로 써요. */
export function createGeckoScene(canvas: HTMLCanvasElement, still: boolean, color: string) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.setClearColor(0x000000, 0)

  const scene = new THREE.Scene()
  // 앞에서 부드럽게 비춰요. 옆면이 너무 어두우면 무거워 보여서 채움 빛을 넉넉히 둬요
  // 빛이 세면 화면을 정면으로 보는 밝은 면(매달렸을 때의 배)이 하얗게 날아가서, 전체 빛을 낮게 둬요
  scene.add(new THREE.HemisphereLight('#ffffff', '#7d8796', 1.15))
  const key = new THREE.DirectionalLight('#ffffff', 1.4)
  key.position.set(0.35, 1, 0.8)
  scene.add(key)
  const fill = new THREE.DirectionalLight('#ffffff', 0.55)
  fill.position.set(-0.8, 0.3, 0.6)
  scene.add(fill)

  const mats = makeMaterials()
  const g = makeGecko(mats)
  // root: 칸 안의 자리, tilt: 윗면이 보이게 살짝 숙이기, turn: 바라보는 쪽
  const root = new THREE.Group()
  const tilt = new THREE.Group()
  tilt.rotation.x = 0.3
  const turn = new THREE.Group()
  root.add(tilt)
  tilt.add(turn)
  turn.add(g.walk, g.sit, g.sleep)
  root.scale.setScalar(1)
  scene.add(root)
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 32), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.14, depthWrite: false }))
  shadow.position.z = -40
  scene.add(shadow)

  // 칸은 위아래 30칸(블록 기준)을 보여줘요. 앉은 도마뱀이 칸의 절반을 조금 넘게 차지해요
  const VIEW = 30
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -200, 200)
  camera.position.z = 100
  const ground = -VIEW / 2 + 2.5
  let halfW = VIEW / 2

  const resize = () => {
    const w = canvas.clientWidth || 1
    const h = canvas.clientHeight || 1
    renderer.setSize(w, h, false)
    halfW = (VIEW / 2) * (w / h)
    Object.assign(camera, { left: -halfW, right: halfW, top: VIEW / 2, bottom: -VIEW / 2 })
    camera.updateProjectionMatrix()
  }
  resize()

  // 테마 색: 디자이너가 흔히 쓰는 같은 색상의 명도 단계예요. 몸은 메인 컬러를 조금 진하게,
  // 줄무늬는 한 단계, 배는 두 단계 밝게 하고 채도를 낮춰요. 색상(hue)은 그대로라 어느 테마든 한 가족으로 보여요
  const setColor = (hex: string) => {
    const hsl = { h: 0, s: 0, l: 0 }
    new THREE.Color(hex).getHSL(hsl)
    mats.body.color.setHSL(hsl.h, hsl.s, Math.max(0.3, hsl.l - 0.02))
    // 밝은 톤은 톤 매핑에서 바래서 채도는 거의 그대로 두고, 흰 화면에 묻히지 않게 너무 밝게는 하지 않아요
    mats.stripe.color.setHSL(hsl.h, hsl.s * 0.9, Math.min(0.6, hsl.l + 0.02))
    mats.belly.color.setHSL(hsl.h, hsl.s * 0.85, Math.min(0.66, hsl.l + 0.08))
  }
  setColor(color)

  let faceKey = ''
  /** mouth: 입을 그릴지. 싫어하는 얼굴(annoyed)이면 가운데가 올라간 ∧ 모양이에요. */
  const drawFace = (style: FaceStyle, mouth: boolean) => {
    const k = `${style}|${mouth}`
    if (k === faceKey) return
    faceKey = k
    for (const face of [g.walkFace, g.sitFace]) {
      for (const m of face.values()) m.material = mats.body
      const e = EYES[style]
      e.left.forEach((left, side) => {
        for (const [cx, cy] of e.cells) {
          const col = e.mirror && side ? (e.w ?? 3) - 1 - cx : cx
          const m = face.get(`${left + col},${10 + cy}`)
          if (m) m.material = mats.eye
        }
        if (e.shine) {
          const m = face.get(`${left + e.shine[0]},${10 + e.shine[1]}`)
          if (m) m.material = mats.shine
        }
      })
      if (mouth) {
        const cells = style === 'annoyed' ? [[-1, 9], [0, 10], [1, 9]] : [[-1, 9], [0, 9], [1, 9]]
        for (const [mx, my] of cells) {
          const m = face.get(`${mx},${my}`)
          if (m) m.material = mats.eye
        }
      }
    }
  }

  // 잠깐 떠다니다 사라지는 블록(달릴 때 흔적, 꽃가루, 땀방울, 끊긴 꼬리)
  interface Bit {
    obj: THREE.Object3D
    vx: number
    vy: number
    g: number
    life: number
    born: number
    spin: number
    floor?: number
  }
  const bits: Bit[] = []
  const fading = (hex: number) => new THREE.MeshStandardMaterial({ color: hex, roughness: 0.5, transparent: true })
  const spawn = (obj: THREE.Object3D, x: number, y: number, rest: Partial<Bit>) => {
    obj.position.set(x, y, 30)
    obj.rotation.x = 0.3
    scene.add(obj)
    bits.push({ obj, vx: 0, vy: 0, g: 0, life: 1, spin: 0, born: clock.getElapsedTime(), ...rest })
  }
  const bit = (hex: number, size: number) => {
    const m = new THREE.Mesh(BLOCK, fading(hex))
    m.scale.setScalar(size)
    return m
  }

  const clock = new THREE.Clock()
  let mood: PetMood = 'idle'
  let lookX = 0
  let x = 0
  let y = 0
  let dir = 1
  let yaw = 0.4
  let moodAt = 0
  let hopStart = -10
  let pokeAt = -10
  let nextHop = 3
  let hopFrom = 0
  let hopTo = 0
  let blinkAt = -1
  let nextBlink = 1.5
  let lastActive = 0
  let grabbed = false
  let releaseAt = -10
  let swing = 0
  let swingSpeed = 0
  let tailGone = 0
  let snapAt = -10
  let flips: number[] = []
  let lastSign = 0
  let nextBit = 0
  let frame = 0
  let last = 0

  const dropTail = (vx: number) => {
    const now = clock.getElapsedTime()
    tailGone = now
    snapAt = now
    const from = g.sleep.visible ? g.sleepTail : g.sit.visible ? g.sitTail : g.tail
    const piece = from.clone(true)
    piece.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh) m.material = (m.material as THREE.Material).clone()
      if (m.isMesh) (m.material as THREE.Material).transparent = true
    })
    from.parent?.add(piece)
    piece.updateMatrixWorld(true)
    scene.attach(piece)
    for (const t of [g.tail, g.sitTail, g.sleepTail]) t.visible = false
    // 매달린 채 끊기면 꼬리가 세로로 서 있어서, 바닥에 눕혀서 떨어뜨려요. 칸 밖으로 나가지 않게 가운데 쪽에 둬요
    piece.rotation.set(0.3, vx > 0 ? 0.5 : -0.5, 0)
    piece.position.x = Math.max(-halfW + 8, Math.min(halfW - 8, piece.position.x))
    piece.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(piece)
    bits.push({ obj: piece, vx, vy: 10, g: 60, life: 6.5, born: now, spin: 0, floor: ground - (box.min.y - piece.position.y) })
  }

  const render = () => {
    const t = clock.getElapsedTime()
    const dt = Math.min(0.05, t - last)
    last = t

    // 초기화: 네 발 모델을 기본으로 두고, 동작마다 앉은 모델이나 자는 모델로 바꿔 끼워요
    g.walk.visible = true
    g.sit.visible = false
    g.sleep.visible = false
    g.walk.rotation.set(0, 0, 0)
    g.walk.position.set(0, 0.5, 0)
    g.walk.scale.set(1, 1, 1)
    g.sit.position.set(0, 0.5, 0)
    g.sit.scale.set(1, 1, 1)
    g.sleep.position.set(0, 0.5, 0)
    g.sleep.scale.set(1, 1, 1)
    g.head.rotation.set(0, 0, 0)
    g.sitHead.rotation.set(0, 0, 0)
    g.tail.rotation.set(0, 0, 0)
    g.sitTail.rotation.set(0, 0, 0)
    g.legs.forEach((l) => l.rotation.set(0, 0, 0))
    g.arms.forEach((a) => a.rotation.set(0, 0, 0))
    g.question.visible = false
    const seat = () => {
      g.walk.visible = false
      g.sit.visible = true
    }

    if (t > nextBlink) {
      blinkAt = t
      nextBlink = t + 2.5 + Math.random() * 3
    }
    const blinking = t < blinkAt + 0.12
    let style: FaceStyle = blinking ? 'blink' : 'open'
    let mouth = false
    let wantYaw = 0.45 + lookX * 0.5
    let hopY = 0

    if (!still) {
      const busy = mood === 'dance'
      if (grabbed) {
        // 고양이 목덜미 잡히듯: 목 뒤를 잡혀 머리는 위, 몸통은 아래로 늘어져요. 앞발은 위로 허우적, 뒷발은 아래로 버둥
        swingSpeed += (-38 * swing - 3 * swingSpeed) * dt
        swing = Math.max(-0.7, Math.min(0.7, swing + swingSpeed * dt))
        const hang = -1.5
        g.walk.rotation.x = hang
        g.walk.rotation.z = swing + Math.sin(t * 9) * 0.05
        g.walk.position.y = 2
        g.head.rotation.x = -hang - 0.12
        g.head.rotation.z = -swing * 0.4 + Math.sin(t * 9 + 1) * 0.05
        g.legs.forEach((l, i) => {
          const front = i < 2
          const phase = i % 2 ? Math.PI : 0
          l.rotation.x = front ? hang + Math.sin(t * 16 + phase) * 0.55 : -hang + Math.sin(t * 13 + phase) * 0.6
          l.rotation.z = (i % 2 ? 1 : -1) * (front ? 0.5 : 0.25)
        })
        g.tail.rotation.y = Math.sin(t * 7) * 0.35
        wantYaw = 0.15 + Math.sin(t * 2.5) * 0.1
        y = VIEW / 2 - 13 - ground
        x = 0
        // 찡그린 눈썹에 실눈, 입은 일자로 꾹. 가끔 질끈 감고, 꼬리가 빠진 순간만 깜짝 놀라요
        style = t - snapAt < 1 ? 'wide' : Math.floor(t * 2.5) % 4 === 3 ? 'blink' : 'annoyed'
        mouth = true
        if (t > nextBit) {
          nextBit = t + 0.25
          const side = Math.random() < 0.5 ? -1 : 1
          spawn(bit(0xbfe9ff, 0.7), x + side * 5, ground + y + 11, { vx: side * 8, vy: 10, g: 40, life: 0.6 })
        }
      } else if (t - releaseAt < 0.6 && y > 0) {
        // 놓으면 떨어져요
        y = Math.max(0, y - dt * 60)
        style = 'wide'
        g.legs.forEach((l, i) => (l.rotation.z = (i % 2 ? 1 : -1) * 0.7))
      } else if (busy) {
        // 분석하거나 자료를 받는 동안: 칸 안을 왔다 갔다 다다다 달려요. 대각선 발을 번갈아 내딛어요
        y = Math.abs(Math.sin(t * 16)) * 0.6
        if (x > halfW - 12) dir = -1
        if (x < -halfW + 12) dir = 1
        x += dir * 14 * dt
        wantYaw = dir * 1.35
        g.legs.forEach((l, i) => (l.rotation.x = Math.sin(t * 16 + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.9))
        g.walk.rotation.x = Math.sin(t * 32) * 0.04
        if (t > nextBit) {
          nextBit = t + 0.07
          spawn(bit(Math.random() < 0.5 ? mats.stripe.color.getHex() : mats.belly.color.getHex(), 0.6 + Math.random() * 0.5), x - dir * 7, ground + 1 + Math.random() * 6, {
            vx: -dir * (4 + Math.random() * 6),
            life: 0.45,
            spin: Math.random() * 6 - 3,
          })
        }
        lastActive = t
      } else if (mood === 'happy' || t - hopStart < 1.4) {
        // 끝났거나 눌렸을 때: 앉은 채 점프하며 두 앞발을 번쩍, 꽃가루
        seat()
        const age = t - Math.max(hopStart, moodAt)
        if (age < 0.05 && !still) {
          const colors = [mats.body.color.getHex(), mats.belly.color.getHex(), mats.stripe.color.getHex(), 0xffffff]
          for (let i = 0; i < 18; i++)
            spawn(bit(colors[i % 4], 0.5 + Math.random() * 0.4), x + Math.random() * 4 - 2, ground + 10, {
              vx: Math.random() * 30 - 15,
              vy: 18 + Math.random() * 18,
              g: 60,
              life: 1.2,
              spin: Math.random() * 10 - 5,
            })
        }
        hopY = Math.max(0, Math.sin(Math.min(age, 0.6) / 0.6 * Math.PI)) * 4
        // 두 팔을 머리 위로 V자로 번쩍. 꼬리는 팔과 겹치지 않게 뒤로 보내요
        g.arms.forEach((a, i) => {
          a.rotation.z = (i ? 1 : -1) * (2.4 + Math.sin(t * 12 + i) * 0.2)
          a.rotation.x = -0.6
        })
        g.sitTail.rotation.y = -0.6 + Math.sin(t * 9) * 0.15
        style = 'happy'
        mouth = true
        wantYaw = 0.25
        lastActive = t
      } else if (mood === 'error') {
        // 실패했을 때: 앉아서 고개를 갸웃하고 머리 위에 물음표
        seat()
        g.question.visible = true
        g.question.position.y = 9.5 + Math.sin(t * 3) * 0.4
        g.sitHead.rotation.z = 0.15 + Math.sin(t * 0.8) * 0.05
        wantYaw = 0.3
        lastActive = t
      } else if (mood === 'talk') {
        seat()
        mouth = Math.sin(t * 14) > 0
        g.arms[1].rotation.z = 0.6 + Math.sin(t * 4) * 0.3
        wantYaw = 0.3
        lastActive = t
      } else if (t - lastActive > SLEEP_AFTER) {
        // 오래 가만히 두면 몸을 말고 꼬리로 감싼 채 잠들어요
        g.walk.visible = false
        g.sleep.visible = true
        g.sleep.scale.y = 1 + Math.sin(t * 1.6) * 0.025
        style = 'blink'
        wantYaw = 0.15
        if (t > nextBit) {
          nextBit = t + 1.6
          const zed = new THREE.Group()
          const mat = fading(mats.stripe.color.getHex())
          // 대각선을 두 칸 굵기로 해서 작아도 Z로 읽혀요
          for (const [zx, zy] of [[0, 3], [1, 3], [2, 3], [3, 3], [2, 2], [3, 2], [1, 1], [2, 1], [0, 0], [1, 0], [2, 0], [3, 0]]) {
            const c = new THREE.Mesh(BLOCK, mat)
            c.scale.setScalar(0.5)
            c.position.set(zx * 0.5, zy * 0.5, 0)
            zed.add(c)
          }
          spawn(zed, x + 4, ground + 9, { vx: 1.5, vy: 2.5, life: 2.2 })
        }
      } else {
        // 평소: 앉아서 숨 쉬듯 들썩이고 두리번거리다가, 가끔 폴짝폴짝 뛰어 자리를 옮겨요
        const hopping = t >= nextHop && t < nextHop + 0.5
        if (hopping) {
          if (hopFrom === hopTo) {
            hopFrom = x
            hopTo = Math.max(-halfW + 12, Math.min(halfW - 12, x + (Math.random() < 0.5 ? -1 : 1) * (4 + Math.random() * 5)))
            if (Math.abs(hopTo - hopFrom) < 1) hopTo = -hopFrom
          }
          const p = (t - nextHop) / 0.5
          x = hopFrom + (hopTo - hopFrom) * p
          hopY = Math.sin(p * Math.PI) * 4
          wantYaw = Math.sign(hopTo - hopFrom) * 1.25
          g.walk.rotation.x = (p - 0.5) * 0.5
          g.legs[0].rotation.x = g.legs[1].rotation.x = -0.9
          g.legs[2].rotation.x = g.legs[3].rotation.x = 0.9
        } else {
          if (t >= nextHop + 0.5) {
            // 한 번 뛰고 나면 가끔 한 번 더 이어서 뛰어요
            nextHop = t + (Math.random() < 0.4 ? 0.15 : 4 + Math.random() * 6)
            hopFrom = hopTo = x
          }
          seat()
          g.sit.scale.y = 1 + Math.sin(t * 2) * 0.015
          g.sitHead.rotation.z = Math.sin(t * 1.1) * 0.05
          g.sitTail.rotation.y = Math.sin(t * 2.2) * 0.15
          wantYaw += Math.sin(t * 0.35) * 0.12
        }
      }
      // 달리거나 매달리거나 떨어지는 중이 아니면 바닥에 앉아요. 동작이 바뀌어도 공중에 뜬 채 남지 않아요
      if (!grabbed && !busy && t - releaseAt >= 0.6) y = 0
      // 놓은 뒤에는 흔들림이 잦아들어요
      if (!grabbed) {
        swingSpeed += (-38 * swing - 9 * swingSpeed) * dt
        swing += swingSpeed * dt
      }
    } else {
      g.walk.visible = false
      g.sit.visible = true
    }

    // 꼬리 다시 자라기
    if (tailGone) {
      const grown = t - tailGone - REGROW
      if (grown > 0) {
        const k = Math.min(1, grown / 1.5)
        for (const tl of [g.tail, g.sitTail, g.sleepTail]) {
          tl.visible = true
          tl.scale.setScalar(0.05 + 0.95 * k)
        }
        if (k >= 1) tailGone = 0
      }
    }

    yaw += (wantYaw - yaw) * Math.min(1, dt * 6)
    turn.rotation.y = yaw
    drawFace(style, mouth)
    root.position.set(x, ground + y + hopY, 0)
    const lift = y + hopY
    const k = Math.max(0.35, 1 - lift / 20)
    shadow.position.set(x, ground - 0.4, -40)
    shadow.scale.set(6.5 * k, 1.1 * k, 1)
    ;(shadow.material as THREE.MeshBasicMaterial).opacity = (grabbed ? 0.06 : document.documentElement.classList.contains('dark') ? 0.35 : 0.14) * k

    for (let i = bits.length - 1; i >= 0; i--) {
      const b = bits[i]
      const age = t - b.born
      b.vy -= b.g * dt
      b.obj.position.x += b.vx * dt
      b.obj.position.y += b.vy * dt
      if (b.floor !== undefined) {
        // 끊긴 꼬리: 바닥에 떨어져서 꿈틀대다 사라져요
        if (b.obj.position.y < b.floor) {
          b.obj.position.y = b.floor
          b.vy = 0
          b.vx *= 0.8
        }
        const wiggle = Math.max(0, 1 - age / 4)
        b.obj.rotation.z = Math.sin(age * 24) * 0.35 * wiggle
      } else b.obj.rotation.z += b.spin * dt
      const fade = b.floor !== undefined ? Math.max(0, Math.min(1, (b.life - age) / 1.5)) : Math.max(0, 1 - age / b.life)
      b.obj.traverse((o) => {
        const m = o as THREE.Mesh
        if (m.isMesh) (m.material as THREE.MeshStandardMaterial).opacity = fade
      })
      if (age > b.life) {
        scene.remove(b.obj)
        b.obj.traverse((o) => {
          const m = o as THREE.Mesh
          if (m.isMesh && m.material !== mats.body) (m.material as THREE.Material).dispose()
        })
        bits.splice(i, 1)
      }
    }

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
      if (next !== mood) {
        moodAt = clock.getElapsedTime()
        lastActive = moodAt
      }
      mood = next
      if (still) render()
    },
    look(value: number) {
      const next = Math.max(-1, Math.min(1, value))
      if (Math.abs(next - lookX) > 0.02) lastActive = clock.getElapsedTime()
      lookX = next
    },
    /** 잡거나 놓아요. */
    grab(on: boolean) {
      if (on === grabbed) return
      grabbed = on
      lastActive = clock.getElapsedTime()
      if (!on) releaseAt = clock.getElapsedTime()
      else flips = []
      if (still) render()
    },
    /** 끌려간 거리(px)예요. 끄는 쪽 반대로 흔들리고, 짧은 시간에 여러 번 세게 흔들면 꼬리가 빠져요. */
    pull(dx: number) {
      swingSpeed -= dx * 0.05
      if (!grabbed || tailGone || Math.abs(dx) < SHAKE_PX) return
      const now = clock.getElapsedTime()
      const sign = Math.sign(dx)
      if (sign !== lastSign) {
        lastSign = sign
        flips.push(now)
      }
      flips = flips.filter((f) => now - f < SHAKE_WINDOW)
      if (flips.length >= SHAKE_FLIPS) {
        dropTail(sign * 12)
        flips = []
      }
    },
    hop() {
      hopStart = clock.getElapsedTime()
      pokeAt = hopStart
      lastActive = hopStart
      if (still) render()
    },
    setColor(hex: string) {
      setColor(hex)
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
        for (const material of Array.isArray(m.material) ? m.material : [m.material]) material.dispose()
      })
      shadow.geometry.dispose()
      renderer.dispose()
      void pokeAt
    },
  }
}
