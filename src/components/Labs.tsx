import { Suspense, lazy, type ComponentType, type LazyExoticComponent } from 'react'
import { track } from '../lib/analytics'
import { messages, pick, useMessages } from '../lib/i18n'
import { followLink } from '../lib/links'
import { PageHeader, ScrollPage } from './AppPage'
import { Notice } from './GapParts'
import { FlaskIcon } from './Icons'
import { stagger } from './ui'

/**
 * 사이드바의 잡아따 Labs를 누르면 여는 실험실 (/labs, 실험 하나는 /labs/아이디)이에요. 화면 제목은 실험실이에요. 진단과 상관없이 재미로 넣는 실험 기능을 모아 둬요.
 * 실험을 더할 때는 컴포넌트를 따로 만들고 아래 EXPERIMENTS에 한 줄 더해요. 실험 코드는 열 때만 받아요.
 */

interface Experiment {
  /** 주소에 쓰는 아이디예요(/labs/아이디). 한 번 정하면 바꾸지 않아요. */
  id: string
  title: { ko: string; en: string }
  /** 카드에 적는 한두 문장이에요. */
  summary: { ko: string; en: string }
  /** 실험 화면이에요. lazy로 넘겨서 열 때만 받아요. */
  screen: LazyExoticComponent<ComponentType>
}

/** 지금 올라와 있는 실험이에요. 위에 있을수록 먼저 보여요. */
const EXPERIMENTS: Experiment[] = [
  {
    id: 'contests',
    title: { ko: '공모전', en: 'Contests' },
    summary: {
      ko: '링커리어, 캠퍼스픽, 위비티, 씽굿의 공모전을 한곳에 모아 분야별로 봐요.',
      en: 'Contests from four Korean contest sites, sorted by category.',
    },
    screen: lazy(() => import('./labs/Contests').then((module) => ({ default: module.Contests }))),
  },
]

// 실험을 더할 때는 이렇게 적어요.
// {
//   id: 'fortune',
//   title: { ko: '오늘의 취업 운세', en: 'Job fortune' },
//   summary: { ko: '...', en: '...' },
//   screen: lazy(() => import('./labs/Fortune').then((module) => ({ default: module.Fortune }))),
// },

const TEXT = messages({
  ko: {
    title: '실험실',
    emptyTitle: '실험실에 오신 것을 환영합니다!',
    emptyBody: '어떤 기능이 준비될까요?',
    missingTitle: '이 실험을 찾을 수 없어요',
    missingBody: '끝났거나 자리를 옮긴 실험이에요.',
    backToLabs: '실험실로 돌아가기',
    back: '실험실로',
  },
  en: {
    title: 'Lab',
    emptyTitle: 'Welcome to the lab!',
    emptyBody: 'What will we cook up next?',
    missingTitle: 'Experiment not found',
    missingBody: 'It may have ended or moved.',
    backToLabs: 'Back to the lab',
    back: 'Back to the lab',
  },
})

export function Labs({ id, onOpen }: { id: string | null; onOpen: (id: string | null) => void }) {
  const L = useMessages(TEXT)
  const experiment = id ? EXPERIMENTS.find((each) => each.id === id) : null

  if (id) {
    const Screen = experiment?.screen
    return (
      <ScrollPage header={<PageHeader title={experiment ? pick(experiment.title) : L.title} onBack={() => onOpen(null)} backLabel={L.back} />}>
        {Screen ? (
          <Suspense fallback={null}>
            <Screen />
          </Suspense>
        ) : (
          <Notice title={L.missingTitle} body={L.missingBody} action={L.backToLabs} onAction={() => onOpen(null)} className="pt-24" />
        )}
      </ScrollPage>
    )
  }

  return (
    <ScrollPage header={<PageHeader title={L.title} />}>
      {EXPERIMENTS.length === 0 ? (
        <div className="flex flex-col items-center gap-4 pt-24">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-gray-50 text-gray-400">
            <FlaskIcon className="size-6" />
          </span>
          <Notice title={L.emptyTitle} body={L.emptyBody} />
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {EXPERIMENTS.map((each, index) => (
            <li key={each.id} className="animate-rise" style={stagger(index)}>
              <a
                href={`/labs/${each.id}`}
                onClick={followLink(() => {
                  track('labs_experiment_open', { experiment: each.id })
                  onOpen(each.id)
                })}
                className="group flex h-full flex-col gap-2 rounded-2xl bg-gray-50 p-5 transition-colors hover:bg-gray-100"
              >
                <span className="text-[15px] font-semibold text-gray-900 transition-colors group-hover:text-brand">{pick(each.title)}</span>
                <span className="text-[13.5px] leading-relaxed text-gray-500">{pick(each.summary)}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </ScrollPage>
  )
}
