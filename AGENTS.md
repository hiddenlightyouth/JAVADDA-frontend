# Javadda 작업 지침

이 문서는 저장소 전체에서 작업하는 Codex의 기본 지침이에요. 사용자 요청을 우선하고, 기존 변경 사항을 덮어쓰거나 작업과 무관한 파일을 커밋하지 않아요.

## 문서 사용과 유지

- 작업을 시작할 때 [CLAUDE.md](CLAUDE.md)의 브랜딩, 텍스트 작성, Git 작업 규칙을 확인하고, 수정할 기능의 상세 설명을 읽어요. API 흐름과 화면별 동작, 단축키, 분석 이벤트, 남은 작업은 그 문서를 참고해요.
- 이 문서는 공통 작업 규칙과 코드 위치를 간결하게 유지해요. 기능별 상세 명세를 통째로 복제하지 않아요.
- 기능이나 구조가 바뀌면 `CLAUDE.md`도 고쳐 같은 커밋에 포함해요. 공통 작업 규칙이 바뀌면 이 문서도 함께 맞춰 두 문서가 충돌하지 않게 해요.
- 문서와 구현이 다르면 실제 코드와 서버 계약을 확인해요. 확인하지 않은 동작을 구현된 기능으로 적지 않아요.

## 서비스와 실행 환경

- Javadda는 신입과 주니어 개발자의 취업 역량 갭을 진단하는 서비스예요. 공고, 이력서, 진단 리포트, 서류 검증과 면접 연습이 중심이에요.
- React, TypeScript, Vite와 Tailwind CSS v4를 사용해요. 의존성은 `npm`과 `package-lock.json`으로 관리해요.
- Spring Boot 백엔드가 회원, 진단과 계정 자료를 맡아요. 이 저장소의 Cloudflare Worker는 `/tts` 음성 요청을 처리해요.
- 브라우저의 `/`는 소개 화면, `/app`은 앱 화면이에요. macOS 앱도 같은 프론트엔드를 사용해요.

| 명령 | 용도 |
| --- | --- |
| `npm ci` | 잠금 파일 기준 의존성 설치 |
| `npm run dev` | 개발 서버 실행, 기본 포트 5173 |
| `npm run typecheck` | `src`, `shared`, `worker` 타입 검사 |
| `npm run build` | 타입 검사, 클라이언트와 SSR 빌드, 소개와 아티클 사전 렌더링 |
| `npm run preview` | 프로덕션 빌드 미리 보기 |
| `npm run worker:dev` | 프로덕션 빌드 후 로컬 Worker 실행 |

- 개발 서버의 `/api`는 `http://localhost:8080`으로 프록시해요. 백엔드를 연결하려면 별도 `JAVADDA-server` 저장소에서 실행해요.
- 백엔드 없이 지원되는 화면을 확인할 때는 커밋하지 않는 `.env.development.local`에 `VITE_MOCK=true`를 설정해요. `src/lib/mock.ts`가 지원하는 API 범위를 먼저 확인해요.
- `preview`와 `worker:dev`는 `.env.production`으로 빌드하므로 운영 API를 사용할 수 있어요. 검증 시 어떤 서버에 요청하는지 확인해요.
- 비밀 값은 `.env`나 `.dev.vars`에 두고 커밋하거나 로그에 출력하지 않아요. `VITE_` 값은 브라우저에 공개돼요. 추적 중인 `.env.production`과 `.env.development`에는 공개 설정만 유지해요.

## 코드 위치와 공통 부품

| 작업 | 먼저 확인할 파일 |
| --- | --- |
| 화면 구성과 이동 | `src/App.tsx`, `src/components/PageView.tsx`, `src/hooks/useScreen.ts` |
| 주소와 앱 구분 | `src/lib/routes.ts`, `src/lib/shell.ts`, `src/lib/links.ts` |
| 진단 자료, API와 계정 저장소 | `src/lib/gap.ts`, `src/lib/http.ts`, `src/lib/auth.ts` |
| 공모전과 기술 블로그 | `src/lib/contests.ts`, `src/lib/blogs.ts`, 해당 화면 컴포넌트 |
| 다국어와 메타 정보 | `src/lib/i18n.ts`, `src/lib/meta.ts` |
| 테마와 공통 스타일 | `src/index.css`, `src/components/ui.tsx` |
| 화면 틀과 제목, 여백 | `src/components/AppPage.tsx`의 `ScrollPage`, `PageHeader`, `gutter`, `bleed` |
| 버튼, 입력, 탭, 진행 표시 | `src/components/ui.tsx` |
| 안내, 오류, 패널, 적합도, 필터 | `src/components/GapParts.tsx` |
| 공고 카드와 목록, 보기 방식 | `src/components/JobCard.tsx`, `src/components/ScreenParts.tsx` |
| 미니 브라우저 | `src/components/PostingBrowser.tsx`의 `PostingBrowser`, `SplitView` |
| 메뉴, 확인 창, 아이콘 | `src/components/Dropdown.tsx`, `src/components/Dialog.tsx`, `src/components/Icons.tsx` |
| 로컬 저장과 공통 상태 | `src/lib/storage.ts`, `src/lib/store.ts` |
| 자료를 받는 진행 표시 | `src/lib/load.ts`, `src/lib/http.ts` |
| 면접과 음성 | `src/components/Practice.tsx`, `src/lib/speech.ts`, `shared/voices.ts`, `worker/tts.ts`, `worker/reading.ts` |
| 분석 이벤트 | `src/lib/analytics.ts`의 `track` |

- 새 화면에서도 기존 공통 부품을 재사용해요. 같은 버튼 모양, 여백, 진행 표시나 창 동작을 화면마다 다시 만들지 않아요.
- 일반 선 아이콘은 `Icons.tsx`에 추가해요. 브랜드 로고와 그래프를 제외하면 화면에 SVG를 직접 적지 않아요. 그래프는 기존 SVG와 CSS 방식에 맞춰요.
- 긴 목록은 `useShowMore`로 처음 24개와 이후 24개씩 그려요. 검색과 필터가 바뀌면 개수를 초기화해요.
- 원문을 앱 안에서 보여줄 때는 `PostingBrowser`와 `SplitView`를 써요. 기업 없는 외부 페이지는 `page`의 `companyId`를 생략해요. 사이트의 프레임 제한은 `canEmbed`와 `FRAME_BLOCKED`를 확인해요.

## 자료와 상태 처리

- 화면에서 API 요청을 흩어 쓰지 말고 `src/lib`의 해당 기능 모듈을 통해 받아요. 진단 관련 요청과 저장소는 `gap.ts`를 사용해요.
- API 기본 주소와 `/api/v1` 접두사는 `http.ts`에서 정해요. 응답은 `{ data, error: { code, message } }` 형식이고 `readResult`, `readWithLoad`로 읽어요. 로그인한 요청은 기존 `authFetch` 흐름을 따라요.
- 이력서와 리포트의 숫자 아이디는 받으면서 문자열로 바꾸고, 서버 요청에서 필요한 곳만 숫자로 바꿔요. 기업과 공고 아이디는 문자열이에요.
- 생성과 진단 계산은 서버의 책임이에요. 기존 프론트 계산인 `fitOf`, `canonical` 등을 바꿀 때는 `CLAUDE.md`의 계산 규칙을 확인해요.
- 계정 자료를 임의의 localStorage에 복제하지 않아요. 화면 설정 등 로컬 값은 `storage.ts`의 함수를 쓰고, 새 키는 `javadda:`로 시작해요.
- 자료를 받는 동안은 내용 모양의 뼈대(`ui`의 `Skeleton`)를 사용해요. AI 생성 대기만 기존 `withProgress`, `AiProgress` 흐름(퍼센트)을 따라요. 로딩, 실패와 빈 결과를 구분해요.
- 외부 링크는 `followLink`와 `isPlainClick`의 관례를 따라 보조 키와 가운데 버튼 동작을 보존해요. 새 탭 링크에는 `noopener noreferrer`를 적용해요.
- 새 주소는 `routes.ts`의 `Page`, `pathOf`와 관련 이동 흐름에 반영해요. `/app`과 언어 접두사는 `shell.ts`, `i18n.ts`를 거쳐 처리하고 화면에서 임의로 덧붙이지 않아요.
- `track`을 사용하고 기존 이벤트 이름과 속성을 보존해요. 이벤트가 바뀌면 `CLAUDE.md`의 이벤트 표도 맞춰요.

## 디자인, 문구와 접근성

- 화면의 서비스명은 `Javadda`, 탭 제목은 언어와 관계없이 `잡아따`예요. 패키지명 `lofy`, `LofyScript` 등 기존 내부 이름을 일괄 변경하지 않아요.
- Pretendard와 자간 -0.02em, `index.css`의 테마 토큰을 사용해요. 주색은 `brand`(#2E90FA), hover는 `brand-hover`(#1570EF), 연한 배경은 `brand-soft`(#EFF8FF)예요.
- 흰 바탕과 회색 텍스트, 여백 중심의 디자인을 유지해요. 강조할 버튼과 수치에만 주색을 써요. 그림자, 이모지, 불필요한 장식이나 그라데이션을 추가하지 않아요. 기존 예외는 `CLAUDE.md`의 브랜딩 규칙을 확인해요.
- 카드와 패널은 기본적으로 `gray-50`, 그 안의 작은 칸은 흰색이에요. 입력칸, 서류 종이와 홈 모양 공고 카드 등 기존 테두리 예외를 유지해요.
- 여백은 `AppPage`의 공통 값을 써요. 휴대폰 16px, 640px 이상 24px, 768px 이상 40px이에요. 한 칸짜리 그리드에도 `grid-cols-1`을 적어 넘침을 막아요.
- 좁은 화면의 필터 줄은 기존 `toolRow`, `filterRow`처럼 가로 스크롤을 사용해요. 컨테이너가 좁아지는 미니 브라우저 배치도 확인해요.
- 문구는 화면별 `messages({ ko, en })`로 모으고 컴포넌트에서는 `useMessages`, 컴포넌트 밖에서는 `pick`으로 꺼내요. 한국어와 영어를 함께 수정해요.
- 한국어는 친근한 존댓말(~해요)을 사용해요. 사용자 서류를 흉내 내는 문단의 격식체는 유지해요. 통계 용어는 일상적인 말로 풀어요.
- 화면 문구와 AI 생성 글에 긴 대시, 가운데점, 화살표 기호, 이모지를 쓰지 않아요. 쉼표와 마침표로 연결해요. 출처나 계산 방식을 불필요하게 작은 문구로 덧붙이지 말고, 필요한 수치 설명은 기존 `Tip`을 써요.
- 아이콘만 있는 버튼에는 접근 가능한 이름을 제공하고, 키보드 포커스 표시와 기존 Esc 닫기 동작을 보존해요. 새 단축키는 `shortcuts.ts`의 입력 중 무시, 보조 키 무시와 `event.code` 관례를 따라요.

## 검증과 완료 보고

- 코드 변경 뒤에는 `npm run typecheck`와 `npm run build`를 실행해요. `typecheck`는 `vite.config.ts`와 `scripts/`를 검사하지 않는 점을 고려해요.
- 현재 `package.json`에는 `test`와 `lint` 스크립트가 없어요. 실행하지 않은 검사를 통과했다고 보고하지 않아요.
- UI 변경은 가능하면 데스크톱과 모바일에서 실제 화면, 주요 클릭과 키보드 동작, 로딩과 오류 상태를 확인해요. 한국어와 영어의 줄바꿈과 넘침도 살펴요.
- 목 응답을 사용했다면 실제 서버나 외부 사이트까지 검증한 것처럼 보고하지 않아요. 실패한 검사와 확인하지 못한 부분은 명확히 적어요.
- 문서만 바꿀 때는 링크, 명령과 파일 경로가 실제 저장소와 맞는지 확인해요. 커밋 전에는 `git diff --check`와 커밋할 diff를 확인해요.

## Git과 배포

- 별도 브랜치를 만들지 않고 `develop`에 커밋하고 푸시해요. 다른 브랜치나 워크트리에서 시작했으면 작업을 보존하면서 최신 `develop` 위로 옮겨요.
- 요청받은 작업이 끝나면 별도 승인을 기다리지 않고 커밋과 푸시를 진행해요. 현재 사용자가 커밋이나 푸시를 제한했다면 그 요청을 따라요.
- 푸시 전에 원격 상태를 확인하고 다른 사람의 변경을 보존해요. 기존 변경을 버리거나 강제 푸시로 덮어쓰지 않아요.
- 커밋 메시지는 간단한 한국어로 `태그: 구현한 내용` 형식을 써요. 태그는 `feat`, `fix`, `docs`, `refactor`, `build`, `ci`, `chore`, `remove`를 사용해요.
- 커밋 메시지에 파일명, 폴더명, 패키지명을 드러내거나 `Co-Authored-By` 같은 협업자 표기를 넣지 않아요. 목적이 다른 변경은 커밋을 나눠요.
- 관련 파일만 명시적으로 스테이징해요. 비밀 설정, 빌드 결과, 개인 작업 파일과 무관한 변경을 포함하지 않아요.
- `develop`에 푸시하면 Cloudflare의 `javadda-frontend`가 빌드하고 배포해요. 웹 주소는 `https://javadda.hidly.dev`, 운영 API는 `https://javadda-api.hidly.dev`예요. 레거시 앱 다운로드와 업데이트 파일은 임의로 삭제하지 않아요.

AGENTS.md 작성 방식 참고: [OpenAI 공식 문서](https://learn.chatgpt.com/docs/agent-configuration/agents-md).
