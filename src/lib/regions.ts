import type { RegionId } from './koreaMap'

/**
 * 채용 지도에서 공고의 위치 글자("서울 송파", "경기 분당, 판교", "서울 송파 또는 충청, 전라, 경상")를 권역과 지도 위의 자리로 바꿔요.
 * 서버는 위치를 사람이 적은 글자 그대로 줘서, 아는 동네와 도시 이름을 찾아 맞춰요. 맞는 게 없으면 지역 무관으로 쳐요.
 */

export type { RegionId }

export const REGIONS: RegionId[] = ['capital', 'gangwon', 'chungcheong', 'jeolla', 'gyeongsang', 'jeju']

export interface Place {
  id: string
  /** 화면에 적는 이름 */
  name: string
  region: RegionId
  lon: number
  lat: number
  /** 위치 글자에서 찾는 말 */
  keys: string[]
  /** 이 자리를 품는 넓은 자리. 둘 다 맞으면 좁은 자리만 남겨요(분당이 맞으면 성남, 서울 송파면 서울은 빼요). */
  within?: string
}

const place = (id: string, name: string, region: RegionId, lon: number, lat: number, keys: string[], within?: string): Place => ({ id, name, region, lon, lat, keys, within })

// 앞에 있는 것부터 찾아요. 넓은 자리(서울, 경기, 권역 이름)는 동네가 하나도 맞지 않을 때 쓰는 자리예요.
export const PLACES: Place[] = [
  place('gangnam', '강남', 'capital', 127.0473, 37.5172, ['강남', '역삼', '삼성동', '선릉'], 'seoul'),
  place('seocho', '서초', 'capital', 127.0324, 37.4837, ['서초', '양재'], 'seoul'),
  place('songpa', '송파', 'capital', 127.1059, 37.5145, ['송파', '잠실', '문정'], 'seoul'),
  place('seongsu', '성수', 'capital', 127.0557, 37.5443, ['성수', '성동'], 'seoul'),
  place('guro', '구로', 'capital', 126.8895, 37.4954, ['구로', '신도림'], 'seoul'),
  place('geumcheon', '가산', 'capital', 126.8826, 37.4772, ['가산', '금천'], 'seoul'),
  place('mapo', '마포', 'capital', 126.9087, 37.5663, ['마포', '상암', '합정', '홍대'], 'seoul'),
  place('yeouido', '여의도', 'capital', 126.9246, 37.5219, ['여의도', '영등포'], 'seoul'),
  place('yongsan', '용산', 'capital', 126.9654, 37.5326, ['용산'], 'seoul'),
  place('jongno', '종로', 'capital', 126.979, 37.5735, ['종로', '광화문'], 'seoul'),
  place('junggu', '을지로', 'capital', 126.9975, 37.564, ['을지로', '서울 중구', '명동'], 'seoul'),
  place('magok', '마곡', 'capital', 126.8256, 37.56, ['마곡', '강서'], 'seoul'),
  place('seoul', '서울', 'capital', 126.978, 37.5665, ['서울']),
  place('pangyo', '판교', 'capital', 127.111, 37.3947, ['판교'], 'seongnam'),
  place('bundang', '분당', 'capital', 127.1218, 37.3726, ['분당', '정자', '서현'], 'seongnam'),
  place('seongnam', '성남', 'capital', 127.1265, 37.42, ['성남'], 'gyeonggi'),
  place('suwon', '수원', 'capital', 127.0286, 37.2636, ['수원', '광교'], 'gyeonggi'),
  place('yongin', '용인', 'capital', 127.1776, 37.2411, ['용인', '기흥', '수지'], 'gyeonggi'),
  place('anyang', '안양', 'capital', 126.9568, 37.3943, ['안양', '평촌'], 'gyeonggi'),
  place('gwacheon', '과천', 'capital', 126.9876, 37.4292, ['과천'], 'gyeonggi'),
  place('hanam', '하남', 'capital', 127.2149, 37.5393, ['하남'], 'gyeonggi'),
  place('goyang', '고양', 'capital', 126.7699, 37.6584, ['고양', '일산'], 'gyeonggi'),
  place('hwaseong', '화성', 'capital', 126.8312, 37.1995, ['화성', '동탄'], 'gyeonggi'),
  place('pyeongtaek', '평택', 'capital', 127.1127, 36.9921, ['평택'], 'gyeonggi'),
  place('gyeonggi', '경기', 'capital', 127.0094, 37.275, ['경기']),
  place('songdo', '송도', 'capital', 126.6566, 37.3826, ['송도'], 'incheon'),
  place('incheon', '인천', 'capital', 126.7052, 37.4563, ['인천']),
  place('chuncheon', '춘천', 'gangwon', 127.7298, 37.8813, ['춘천'], 'gangwon'),
  place('wonju', '원주', 'gangwon', 127.92, 37.3422, ['원주'], 'gangwon'),
  place('gangneung', '강릉', 'gangwon', 128.8761, 37.7519, ['강릉'], 'gangwon'),
  place('gangwon', '강원', 'gangwon', 128.2, 37.75, ['강원']),
  place('sejong', '세종', 'chungcheong', 127.289, 36.48, ['세종'], 'chungcheong'),
  place('cheongju', '청주', 'chungcheong', 127.489, 36.6424, ['청주', '오송', '오창'], 'chungcheong'),
  place('cheonan', '천안', 'chungcheong', 127.1139, 36.8151, ['천안', '아산'], 'chungcheong'),
  place('daejeon', '대전', 'chungcheong', 127.3845, 36.3504, ['대전', '대덕'], 'chungcheong'),
  place('chungcheong', '충청', 'chungcheong', 127.3845, 36.3504, ['충청', '충북', '충남']),
  place('jeonju', '전주', 'jeolla', 127.148, 35.8242, ['전주'], 'jeolla'),
  place('naju', '나주', 'jeolla', 126.7109, 35.0158, ['나주'], 'jeolla'),
  place('gwangju', '광주', 'jeolla', 126.8526, 35.1595, ['광주'], 'jeolla'),
  place('jeolla', '전라', 'jeolla', 126.8526, 35.1595, ['전라', '전북', '전남', '호남']),
  place('haeundae', '해운대', 'gyeongsang', 129.131, 35.169, ['해운대', '센텀'], 'busan'),
  place('busan', '부산', 'gyeongsang', 129.0756, 35.1796, ['부산'], 'gyeongsang'),
  place('daegu', '대구', 'gyeongsang', 128.6014, 35.8714, ['대구'], 'gyeongsang'),
  place('ulsan', '울산', 'gyeongsang', 129.3114, 35.5384, ['울산'], 'gyeongsang'),
  place('changwon', '창원', 'gyeongsang', 128.6811, 35.228, ['창원'], 'gyeongsang'),
  place('pohang', '포항', 'gyeongsang', 129.3435, 36.019, ['포항'], 'gyeongsang'),
  place('gumi', '구미', 'gyeongsang', 128.3445, 36.1195, ['구미'], 'gyeongsang'),
  place('gyeongsang', '경상', 'gyeongsang', 129.0756, 35.1796, ['경상', '경북', '경남', '영남']),
  place('jeju', '제주', 'jeju', 126.5312, 33.4996, ['제주']),
]

const PLACE_BY_ID = new Map(PLACES.map((item) => [item.id, item]))

/** 위치 글자에서 찾은 자리들이에요. 넓은 자리와 좁은 자리가 같이 맞으면 좁은 자리만 남겨요. */
export function placesOf(location: string): Place[] {
  // "경기 광주"는 전라권의 광주가 아니라 경기의 광주시예요.
  const text = location.replace(/경기\s*광주/g, '경기')
  const found = PLACES.filter((item) => item.keys.some((key) => text.includes(key)))
  const ids = new Set(found.map((item) => item.id))
  // 고른 자리를 품는 넓은 자리를 모두 빼요. 송파가 맞으면 서울을, 판교가 맞으면 성남과 경기를 빼요.
  for (const item of found) {
    let parent = item.within
    while (parent) {
      ids.delete(parent)
      parent = PLACE_BY_ID.get(parent)?.within
    }
  }
  return found.filter((item) => ids.has(item.id))
}

/** 서울, 경기, 권역 이름처럼 동네를 알 수 없는 넓은 자리예요. */
export const isBroad = (place: Place) => !place.within

/** 두 자리 사이의 대략적인 거리(km)예요. 우리나라 위도에서 경도 1도는 대체로 88km, 위도 1도는 111km예요. */
export const kmBetween = (a: { lon: number; lat: number }, b: { lon: number; lat: number }) => Math.hypot((a.lon - b.lon) * 88, (a.lat - b.lat) * 111)
