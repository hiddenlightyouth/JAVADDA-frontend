// 채용 지도의 경계선(src/lib/koreaMap.ts)을 만들어요. 한 번 만들어 커밋해 두고, 경계 자료가 바뀔 때만 다시 돌려요.
// 자료는 통계청 행정구역 경계를 줄인 southkorea-maps(kostat 2013, 자유롭게 쓰고 고쳐도 돼요)예요.
//   curl -LO https://raw.githubusercontent.com/southkorea/southkorea-maps/master/kostat/2013/json/skorea_provinces_geo_simple.json
//   curl -LO https://raw.githubusercontent.com/southkorea/southkorea-maps/master/kostat/2013/json/skorea_municipalities_geo_simple.json
//   node scripts/korea-map.mjs skorea_provinces_geo_simple.json skorea_municipalities_geo_simple.json
import { readFileSync, writeFileSync } from 'node:fs'

const [provincesFile, municipalitiesFile] = process.argv.slice(2)
if (!provincesFile || !municipalitiesFile) {
  console.error('usage: node scripts/korea-map.mjs <provinces.json> <municipalities.json>')
  process.exit(1)
}

// src/lib/koreaMap.ts의 project와 같은 값이에요. 바꾸면 두 곳을 같이 바꿔요.
const LON0 = 124.5
const LAT0 = 38.7
const SCALE = 100
const COS = Math.cos((36.5 * Math.PI) / 180)
const project = ([lon, lat]) => [(lon - LON0) * COS * SCALE, (LAT0 - lat) * SCALE]

// 시도 코드마다 권역이에요.
const REGION_OF = {
  11: 'capital', 23: 'capital', 31: 'capital',
  32: 'gangwon',
  25: 'chungcheong', 29: 'chungcheong', 33: 'chungcheong', 34: 'chungcheong',
  24: 'jeolla', 35: 'jeolla', 36: 'jeolla',
  21: 'gyeongsang', 22: 'gyeongsang', 26: 'gyeongsang', 37: 'gyeongsang', 38: 'gyeongsang',
  39: 'jeju',
}

const round = (value) => Math.round(value * 10) / 10
const polygonsOf = (geometry) => (geometry.type === 'MultiPolygon' ? geometry.coordinates : [geometry.coordinates])

function pathOf(polygons) {
  return polygons
    .flatMap((polygon) => polygon)
    .map((ring) => {
      const points = []
      for (const point of ring) {
        const [x, y] = project(point).map(round)
        const last = points[points.length - 1]
        if (!last || last[0] !== x || last[1] !== y) points.push([x, y])
      }
      return points.length < 3 ? '' : `M${points.map(([x, y]) => `${x},${y}`).join(' ')}Z`
    })
    .join('')
}

// 자료에 독도가 없어서 동도와 서도를 작게 더해요.
const DOKDO = [
  [[[131.8675, 37.2395], [131.8705, 37.2405], [131.8725, 37.2385], [131.871, 37.2365], [131.868, 37.2372], [131.8675, 37.2395]]],
  [[[131.862, 37.2425], [131.8655, 37.2432], [131.8665, 37.2405], [131.8635, 37.2395], [131.8615, 37.241], [131.862, 37.2425]]],
]

const provinces = JSON.parse(readFileSync(provincesFile, 'utf8')).features.map((feature) => {
  const code = feature.properties.code
  const polygons = polygonsOf(feature.geometry)
  return { code, name: feature.properties.name, region: REGION_OF[code], d: pathOf(code === '37' ? [...polygons, ...DOKDO] : polygons) }
})

// 수도권으로 확대했을 때 그리는 시군구 경계예요.
const metro = JSON.parse(readFileSync(municipalitiesFile, 'utf8'))
  .features.filter((feature) => ['11', '23', '31'].includes(feature.properties.code.slice(0, 2)))
  .map((feature) => ({ name: feature.properties.name, d: pathOf(polygonsOf(feature.geometry)) }))

// 권역마다 경계를 감싸는 칸이에요. 권역을 고르면 이 칸으로 확대해요.
const boxes = {}
for (const feature of JSON.parse(readFileSync(provincesFile, 'utf8')).features) {
  const region = REGION_OF[feature.properties.code]
  for (const polygon of polygonsOf(feature.geometry)) {
    for (const point of polygon[0]) {
      const [x, y] = project(point)
      const box = (boxes[region] ??= [Infinity, Infinity, -Infinity, -Infinity])
      box[0] = Math.min(box[0], x)
      box[1] = Math.min(box[1], y)
      box[2] = Math.max(box[2], x)
      box[3] = Math.max(box[3], y)
    }
  }
}

const all = Object.values(boxes)
const width = Math.ceil(Math.max(...all.map((box) => box[2]), project([131.88, 0])[0]) + 8)
const height = Math.ceil(Math.max(...all.map((box) => box[3])) + 8)

const out = `// 이 파일은 scripts/korea-map.mjs가 만들어요. 고치지 말고 스크립트를 다시 돌려요.
// 경계는 통계청 행정구역 경계(southkorea-maps, kostat 2013)를 줄인 것이에요.

export type RegionId = 'capital' | 'gangwon' | 'chungcheong' | 'jeolla' | 'gyeongsang' | 'jeju'

export const MAP_WIDTH = ${width}
export const MAP_HEIGHT = ${height}

/** 경도와 위도를 지도 위의 자리로 바꿔요. scripts/korea-map.mjs와 같은 값이에요. */
export function project(lon: number, lat: number): [number, number] {
  return [(lon - ${LON0}) * ${COS.toFixed(6)} * ${SCALE}, (${LAT0} - lat) * ${SCALE}]
}

/** 시도 경계예요. */
export const PROVINCES: { code: string; name: string; region: RegionId; d: string }[] = ${JSON.stringify(provinces)}

/** 수도권(서울, 인천, 경기)의 시군구 경계예요. */
export const METRO: { name: string; d: string }[] = ${JSON.stringify(metro)}

/** 권역마다 경계를 감싸는 칸이에요. [왼쪽, 위, 오른쪽, 아래] */
export const REGION_BOXES: Record<RegionId, [number, number, number, number]> = ${JSON.stringify(Object.fromEntries(Object.entries(boxes).map(([key, box]) => [key, box.map(round)])))}
`
writeFileSync(new URL('../src/lib/koreaMap.ts', import.meta.url), out)
console.log(`koreaMap.ts ${(out.length / 1024).toFixed(1)}KB, ${width}x${height}`)
