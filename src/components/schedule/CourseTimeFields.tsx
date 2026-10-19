import { courseTimeError } from '../../coursePresentation'

type Props = {
  period: number
  startTime?: string
  endTime?: string
  onStartChange: (value: string) => void
  onEndChange: (value: string) => void
  onClear: () => void
}

/**
 * Keep the real, accessible native time input for the platform picker, but
 * render its value in our own full-width control. Mobile Safari draws the
 * inner editable area much narrower than the input's CSS box otherwise.
 */
export function CourseTimeFields({
  period, startTime = '', endTime = '', onStartChange, onEndChange, onClear,
}: Props) {
  const error = courseTimeError({ startTime, endTime })
  const hasValue = Boolean(startTime || endTime)

  return (
    <div className="course-time-fields">
      <div className={`course-time-inputs${hasValue ? ' has-clear' : ''}`}>
        <label className="course-time-field">
          <span className="course-time-caption">开始</span>
          <span className="course-time-control">
            <span className={`course-time-display${startTime ? '' : ' is-placeholder'}`} aria-hidden="true">
              {startTime || '选择时间'}
            </span>
            <input
              type="time"
              step={60}
              value={startTime}
              onChange={(event) => onStartChange(event.target.value)}
              aria-label={`第${period}节开始时间`}
            />
          </span>
        </label>
        <label className="course-time-field">
          <span className="course-time-caption">结束</span>
          <span className="course-time-control">
            <span className={`course-time-display${endTime ? '' : ' is-placeholder'}`} aria-hidden="true">
              {endTime || '选择时间'}
            </span>
            <input
              type="time"
              step={60}
              value={endTime}
              onChange={(event) => onEndChange(event.target.value)}
              aria-label={`第${period}节结束时间`}
            />
          </span>
        </label>
        {hasValue && (
          <button className="course-time-clear" type="button" onClick={onClear}>
            清空
          </button>
        )}
      </div>
      {error && <small className="course-time-warning" role="status">{error}</small>}
    </div>
  )
}
