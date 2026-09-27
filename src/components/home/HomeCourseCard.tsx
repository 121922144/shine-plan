import { periodTime } from '../../coursePresentation'
import type { Slot } from '../../domain'
import { CourseIcon } from './CourseIcon'

const periodNames = ['第一节', '第二节', '第三节', '第四节', '第五节', '第六节', '第七节', '第八节']

export function HomeCourseCard({ slot, status, iconSrc }: { slot: Slot; status: string; iconSrc: string }) {
  return (
    <li className="shine-course-card">
      <span className="shine-period">{periodNames[slot.period - 1] ?? `第${slot.period}节`}</span>
      <CourseIcon key={iconSrc} src={iconSrc} />
      <div className="shine-course-info"><h3>{slot.name}</h3><p>{periodTime(slot.period)}</p></div>
      <span className="shine-course-status" title="课程状态为示例，尚未接入签到数据">{status}<span className="visually-hidden">（示例）</span></span>
    </li>
  )
}
