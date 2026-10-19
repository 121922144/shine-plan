import { useState } from 'react'
import { Clock3, Pencil } from 'lucide-react'
import { courseTimeError, courseTimeLabel, type CourseStatus } from '../../coursePresentation'
import type { Slot } from '../../domain'
import { resolveCourseIcon } from '../../features/home/courseIconMap'
import { CourseIcon } from '../home/CourseIcon'
import { CourseTimeFields } from './CourseTimeFields'

const periodNames = ['第一节', '第二节', '第三节', '第四节', '第五节', '第六节', '第七节', '第八节']

export function ScheduleCourseCard({
  period,
  slot,
  status,
  onChange,
  onTimeChange,
  onApplyToWeek,
  readOnly = false,
}: {
  period: number
  slot?: Slot
  status: CourseStatus | '休息' | null
  onChange: (name: string) => void
  onTimeChange: (startTime?: string, endTime?: string) => void
  onApplyToWeek: (startTime: string, endTime: string) => boolean
  readOnly?: boolean
}) {
  const empty = !slot
  const [editingTime, setEditingTime] = useState(false)
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const displayTime = slot ? courseTimeLabel(slot) : ''
  const timeError = courseTimeError({ startTime, endTime })

  const openTimeEditor = () => {
    setStartTime(slot?.startTime || '')
    setEndTime(slot?.endTime || '')
    setEditingTime(true)
  }

  const saveTime = () => {
    if (timeError) return
    onTimeChange(startTime || undefined, endTime || undefined)
    setEditingTime(false)
  }

  return (
    <div className={`schedule-course-card${empty ? ' is-empty' : ''}${editingTime ? ' is-editing' : ''}`}>
      <span className="schedule-period-badge">{periodNames[period - 1] ?? `第${period}节`}</span>
      <span className="schedule-course-icon-wrap"><CourseIcon src={resolveCourseIcon(slot?.name ?? '无课程')} /></span>
      <div className="schedule-course-copy">
        <input
          value={slot?.name ?? ''}
          readOnly={readOnly}
          onChange={(event) => onChange(event.target.value)}
          placeholder="这一节休息一下～"
          aria-label={`第${period}节课程`}
        />
        {slot && !readOnly && (
          <button
            className="schedule-time-trigger"
            type="button"
            onClick={openTimeEditor}
            aria-label={`修改第${period}节上课时间`}
            aria-expanded={editingTime}
          >
            <Clock3 size={13} />
            <span>{displayTime || '设置上课时间'}</span>
            <Pencil size={11} />
          </button>
        )}
        {slot && readOnly && displayTime && <small>{displayTime}</small>}
      </div>
      {status && (
        <span className={`schedule-course-status${status === '已上课' ? ' is-finished' : status === '休息' ? ' is-rest' : ''}`}>
          {status}
        </span>
      )}
      {editingTime && slot && (
        <div className="schedule-time-editor">
          <CourseTimeFields
            period={period}
            startTime={startTime}
            endTime={endTime}
            onStartChange={setStartTime}
            onEndChange={setEndTime}
            onClear={() => { setStartTime(''); setEndTime('') }}
          />
          <div className="schedule-time-editor-actions">
            <button type="button" onClick={() => setEditingTime(false)}>取消</button>
            <button type="button" className="is-primary" disabled={Boolean(timeError)} onClick={saveTime}>
              保存时间
            </button>
            <button
              type="button"
              className="is-apply-week"
              disabled={Boolean(timeError) || !startTime || !endTime}
              onClick={() => {
                if (onApplyToWeek(startTime, endTime)) setEditingTime(false)
              }}
            >
              应用到每天
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
