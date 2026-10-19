import { courseTimeError } from '../../coursePresentation'

type Props = {
  period: number
  startTime?: string
  endTime?: string
  onStartChange: (value: string) => void
  onEndChange: (value: string) => void
  onClear: () => void
}

/** Shared native time pickers for import review and schedule-page editing. */
export function CourseTimeFields({
  period, startTime = '', endTime = '', onStartChange, onEndChange, onClear,
}: Props) {
  const error = courseTimeError({ startTime, endTime })

  return (
    <div className="course-time-fields">
      <div className="course-time-inputs">
        <label className="course-time-field">
          <span>开始</span>
          <input
            type="time"
            step={60}
            value={startTime}
            onChange={(event) => onStartChange(event.target.value)}
            aria-label={`第${period}节开始时间`}
          />
        </label>
        <span className="course-time-separator" aria-hidden="true">—</span>
        <label className="course-time-field">
          <span>结束</span>
          <input
            type="time"
            step={60}
            value={endTime}
            onChange={(event) => onEndChange(event.target.value)}
            aria-label={`第${period}节结束时间`}
          />
        </label>
        {(startTime || endTime) && (
          <button className="course-time-clear" type="button" onClick={onClear}>
            清空
          </button>
        )}
      </div>
      {error && <small className="course-time-warning" role="status">{error}</small>}
    </div>
  )
}
