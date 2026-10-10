import { periodTime } from '../../coursePresentation'
import type { Slot } from '../../domain'
import { CourseIcon } from './CourseIcon'

const periodNames = ['第一节', '第二节', '第三节', '第四节', '第五节', '第六节', '第七节', '第八节']

export function HomeCourseCard({ slot, status, iconSrc }: { slot: Slot; status: string; iconSrc: string }) {
  return (
    <li className="schedule-course-card">
      <span className="schedule-period-badge">{periodNames[slot.period - 1] ?? `第${slot.period}节`}</span>
      <span className="schedule-course-icon-wrap"><CourseIcon key={iconSrc} src={iconSrc} /></span>
      <span className="schedule-course-copy">
        <h3>{slot.name}</h3>
        <small>{periodTime(slot.period)}</small>
      </span>
      <span
        className={`schedule-course-status${status === '已上课' ? ' is-finished' : ''}`}
        title="课程状态为示例，尚未接入签到数据"
      >
        {status}<span className="visually-hidden">（示例）</span>
      </span>
    </li>
  )
}
