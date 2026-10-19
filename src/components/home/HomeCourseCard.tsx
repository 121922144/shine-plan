import { courseTimeLabel, type CourseStatus } from '../../coursePresentation'
import type { Slot } from '../../domain'
import { CourseIcon } from './CourseIcon'

const periodNames = ['第一节', '第二节', '第三节', '第四节', '第五节', '第六节', '第七节', '第八节']

export function HomeCourseCard({
  slot, status, iconSrc,
}: {
  slot: Slot
  status: CourseStatus | null
  iconSrc: string
}) {
  const time = courseTimeLabel(slot)
  return (
    <li className="schedule-course-card">
      <span className="schedule-period-badge">{periodNames[slot.period - 1] ?? `第${slot.period}节`}</span>
      <span className="schedule-course-icon-wrap"><CourseIcon key={iconSrc} src={iconSrc} /></span>
      <span className="schedule-course-copy">
        <h3>{slot.name}</h3>
        {time && <small>{time}</small>}
      </span>
      {status && (
        <span
          className={`schedule-course-status${status === '已上课' ? ' is-finished' : ''}`}
          title="按保存的课程结束时间推算，并非实际签到记录"
        >
          {status}
        </span>
      )}
    </li>
  )
}
