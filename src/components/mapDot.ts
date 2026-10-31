/**
 * 네이버 지도에 찍는 현위치 같은 파란 점이에요. 채용 지도의 내 위치(`NaverJobMap`)와 기업 상세의 본사 자리(`CompanyLocation`)가 같이 써요.
 * 네이버 지도의 마커는 HTML 글자로 받고 Tailwind class가 다 먹지 않아서, SVG 지도의 `LocationDot`과 같은 모양을 인라인 스타일로 적어요.
 * 지도 바탕이 다크 모드에서도 밝아서 색은 고정값(메인 컬러 #2E90FA, 옅은 테 15%, 흰 테두리)이에요. 40px 칸의 가운데(20, 20)를 자리에 맞춰요.
 */
export const LOCATION_DOT_HTML =
  '<div style="position:relative;width:40px;height:40px">' +
  '<div style="position:absolute;inset:0;border-radius:9999px;background:rgba(46,144,250,.15)"></div>' +
  '<div style="position:absolute;left:12px;top:12px;width:16px;height:16px;border-radius:9999px;background:#2E90FA;border:3px solid #fff;box-sizing:border-box"></div>' +
  '</div>'
