import type { Resume, ResumeProject } from './gap'

/** 서류 상세 화면의 마크다운 복사에서 고르는 범위예요. GitHub 서류는 이력서, 포트폴리오, 둘 다를 골라요. */
export type ResumeMarkdownPart = 'all' | 'resume' | 'portfolio'

/** 마크다운에 적는 머리글과 이름이에요. 화면 언어에 맞춰 넘겨요. */
export interface ResumeMarkdownLabels {
  skills: string
  paragraphs: string
  projects: string
  portfolio: string
  role: string
  stack: string
  problems: string
  kinds: Record<ResumeProject['kind'], string>
  parts: { problem: string; cause: string; solution: string; effect: string; decision: string }
}

const PARTS = ['problem', 'cause', 'solution', 'effect', 'decision'] as const

/** 프로젝트 하나의 이력서 글이에요. 소개, 팀과 기간, 역할, 기술 스택, 요약, 문제 해결 경험 순서예요. */
function projectResume(project: ResumeProject, L: ResumeMarkdownLabels) {
  const lines = [`### ${project.name}`]
  if (project.headline) lines.push('', project.headline)
  lines.push('', `- ${[L.kinds[project.kind] ?? project.kind, project.period].filter(Boolean).join(', ')}`)
  if (project.role) lines.push(`- ${L.role}: ${project.role}`)
  if (project.stack.length > 0) lines.push(`- ${L.stack}: ${project.stack.join(', ')}`)
  if (project.summary) lines.push('', project.summary)
  if (project.problems.length > 0) {
    lines.push('', `#### ${L.problems}`)
    for (const problem of project.problems) {
      lines.push('', `**${problem.title}**`, '')
      for (const part of PARTS) {
        if (problem[part]) lines.push(`- ${L.parts[part]}: ${problem[part].replace(/\n+/g, ' ')}`)
      }
    }
  }
  return lines.join('\n')
}

/** 프로젝트 하나의 포트폴리오 글이에요. 항목 본문은 서버가 머리글을 ###로 낮춰 두어서 그대로 붙여요. */
function projectPortfolio(project: ResumeProject) {
  return [`### ${project.name}`, ...project.portfolio.map((section) => `#### ${section.title}\n\n${section.content}`)].join('\n\n')
}

/** 서류 전체를 노션이나 깃허브에 그대로 붙여 넣는 마크다운으로 바꿔요. */
export function resumeMarkdown(resume: Resume, part: ResumeMarkdownPart, L: ResumeMarkdownLabels) {
  const blocks = [`# ${resume.name}`]
  const withResume = part !== 'portfolio'
  if (withResume && resume.skills.length > 0) {
    blocks.push(`## ${L.skills}\n\n${resume.skills.map((skill) => skill.name).join(', ')}`)
  }
  if (resume.projects.length === 0) {
    if (withResume && resume.paragraphs.length > 0) {
      blocks.push(`## ${L.paragraphs}\n\n${resume.paragraphs.map((paragraph, order) => `${order + 1}. ${paragraph.replace(/\n+/g, ' ')}`).join('\n')}`)
    }
    return blocks.join('\n\n')
  }
  if (withResume) blocks.push(`## ${L.projects}`, ...resume.projects.map((project) => projectResume(project, L)))
  const portfolios = resume.projects.filter((project) => project.portfolio.length > 0)
  if (part !== 'resume' && portfolios.length > 0) blocks.push(`## ${L.portfolio}`, ...portfolios.map(projectPortfolio))
  return blocks.join('\n\n')
}
