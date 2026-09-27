import { CheckCircle2, ChevronRight, Circle, Flame } from 'lucide-react'
import { homeMock } from '../../features/home/homeMock'

export function DailyGoalsCard({ prepared, onPreparedChange, onViewTomorrow }: {
  prepared: boolean
  onPreparedChange: () => void
  onViewTomorrow: () => void
}) {
  const completed = prepared ? homeMock.totalGoals : homeMock.initialCompletedGoals
  return (
    <details className="shine-goals">
      <summary className="shine-goals-summary">
        <span className="shine-goal-star" aria-hidden="true"><img src="/assets/icons/star.png" alt="" width="65" height="65" decoding="async" /></span>
        <span className="shine-goals-overview">
          <span className="shine-goals-title">今日小目标</span>
          <span className="shine-goals-count">已完成 <strong>{completed} / {homeMock.totalGoals}</strong></span>
          <progress className="shine-progress" max={homeMock.totalGoals} value={completed} aria-label="今日小目标完成进度" />
        </span>
        <ChevronRight className="shine-goals-chevron" aria-hidden="true" />
      </summary>
      <div className="shine-goals-details">
        <div className="shine-task-heading"><h2>今日任务</h2><button type="button" onClick={onViewTomorrow}>查看明天课程 <ChevronRight size={16} /></button></div>
        <div className="shine-task-checklist">
          <div><CheckCircle2 /><span>查看明天课程</span></div>
          <div><CheckCircle2 /><span>整理好书包</span></div>
          <button type="button" aria-pressed={prepared} onClick={onPreparedChange}>{prepared ? <CheckCircle2 /> : <Circle />}<span>{prepared ? '已经准备好' : '我已准备好'}</span></button>
        </div>
        <div className="shine-reward-stats">
          <div><span>今日获得</span><strong><img className="shine-reward-star" src="/assets/icons/star.png" alt="" width="23" height="23" decoding="async" />{homeMock.todayStars}<small>颗星</small></strong></div>
          <div><span>连续打卡</span><strong><Flame aria-hidden="true" />{homeMock.streakDays}<small>天</small></strong></div>
        </div>
        <p className="shine-badge-caption">距离下一个徽章还差 <strong>{homeMock.starsToNextBadge}</strong> 颗星</p>
        <progress className="shine-progress" max={100} value={homeMock.badgeProgress} aria-label="徽章进度（示例）" />
        <p className="shine-demo-note">星星与连续打卡为示例展示</p>
      </div>
    </details>
  )
}
