const iconRoot = '/course-icons'

// 按顺序匹配；复合课程优先使用更明确的课程类型。
// 新增课程时，在此补充别名或新增一项即可。
export const courseIconMap = [
  { names: ['班会', '队会', '升旗'], src: `${iconRoot}/class-meeting.png` },
  { names: ['道德与法治', '道德', '法治', '品德'], src: `${iconRoot}/morality-law.png` },
  { names: ['综合实践', '劳动', '劳技', '实践'], src: `${iconRoot}/practical-labor.png` },
  { names: ['书法', '写字'], src: `${iconRoot}/calligraphy.png` },
  { names: ['围棋'], src: `${iconRoot}/go.png` },
  { names: ['语文', '阅读', '作文'], src: `${iconRoot}/chinese.png` },
  { names: ['数学'], src: `${iconRoot}/math.png` },
  { names: ['英语'], src: `${iconRoot}/english.png` },
  { names: ['美术', '绘画'], src: `${iconRoot}/art.png` },
  { names: ['音乐'], src: `${iconRoot}/music.png` },
  { names: ['科学'], src: `${iconRoot}/science.png` },
  { names: ['体育', '体活'], src: `${iconRoot}/sports.png` },
  { names: ['心理', '健康', '成长'], src: `${iconRoot}/wellbeing.png` },
  { names: ['无课程', '休息', '空课'], src: `${iconRoot}/no-course.png` },
] as const

export const fallbackCourseIcon = `${iconRoot}/no-course.png`

export function resolveCourseIcon(name: string): string {
  const normalized = name.replace(/\s+/g, '')
  return courseIconMap.find(({ names }) => names.some(alias => normalized.includes(alias)))?.src ?? fallbackCourseIcon
}
