import { periodTime } from '../../coursePresentation'
import type { Slot } from '../../domain'
import { resolveCourseIcon } from '../../features/home/courseIconMap'
import { CourseIcon } from '../home/CourseIcon'

const periodNames = ['第一节', '第二节', '第三节', '第四节', '第五节', '第六节', '第七节', '第八节']

export function ScheduleCourseCard({
  period,
  slot,
  status,
  onChange,
  readOnly = false,
}: {
  period: number
  slot?: Slot
  status: '已上课' | '待上课' | '休息'
  onChange: (name: string) => void
  readOnly?: boolean
}) {
  const empty = !slot

  return (
    <label className={`schedule-course-card${empty ? ' is-empty' : ''}`}>
      <span className="schedule-period-badge">{periodNames[period - 1] ?? `第${period}节`}</span>
      <span className="schedule-course-icon-wrap"><CourseIcon src={resolveCourseIcon(slot?.name ?? '无课程')} /></span>
      <span className="schedule-course-copy">
        <input
          value={slot?.name ?? ''}
          readOnly={readOnly}
          onChange={(event) => onChange(event.target.value)}
          placeholder="这一节休息一下～"
          aria-label={`第${period}节课程`}
        />
        <small>{periodTime(period)}</small>
      </span>
      <span className={`schedule-course-status ${status === '已上课' ? 'is-finished' : status === '休息' ? 'is-rest' : ''}`}>{status}</span>
    </label>
  )
}
