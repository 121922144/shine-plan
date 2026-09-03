'use client'

import { useState } from 'react'
import { Bell, BellRing, BookOpen, CalendarDays, Clock3, Download, Pencil, Plus, Trash2, Upload, X } from 'lucide-react'

export type Slot = { id: string; day: number; period: number; name: string }
export type BookMap = Record<string, string[]>
export type ReminderSettings = { enabled: boolean; time: string; lastSent: string }

const DAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const SCHOOL_DAYS = [1, 2, 3, 4, 5]
const PERIODS = Array.from({ length: 8 }, (_, index) => index + 1)
const COLORS = ['#f4b942', '#ef745c', '#79a7a0', '#7d8fc7', '#a97cba', '#d98c56']
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

function subjectColor(subject: string) {
  let score = 0
  for (const char of subject) score += char.charCodeAt(0)
  return COLORS[score % COLORS.length]
}

export function SchedulePage({ slots, onChange, onImport }: { slots: Slot[]; onChange: (slots: Slot[]) => void; onImport: () => void }) {
  const [day, setDay] = useState(Math.min(5, Math.max(1, new Date().getDay())))
  const getSlot = (period: number) => slots.find((slot) => slot.day === day && slot.period === period)
  const update = (period: number, name: string) => {
    const current = getSlot(period)
    if (current) {
      onChange(name.trim() ? slots.map((slot) => slot.id === current.id ? { ...slot, name } : slot) : slots.filter((slot) => slot.id !== current.id))
    } else if (name.trim()) onChange([...slots, { id: uid(), day, period, name }])
  }
  return (
    <section>
      <div className="page-heading"><div><p className="eyebrow">WEEKLY</p><h2>我的课程表</h2></div><button className="small-button" onClick={onImport}><Upload size={16} />重新导入</button></div>
      <div className="day-tabs">{SCHOOL_DAYS.map((item) => <button key={item} className={day === item ? 'active' : ''} onClick={() => setDay(item)}><span>{DAYS[item].slice(1)}</span></button>)}</div>
      <p className="helper-text">识别有误？直接修改对应课程即可。</p>
      <div className="period-list">{PERIODS.map((period) => {
        const slot = getSlot(period)
        return <label className="period-row" key={`${day}-${period}`}><span>{period}</span><input value={slot?.name ?? ''} onChange={(event) => update(period, event.target.value)} placeholder="无课程" /></label>
      })}</div>
    </section>
  )
}

export function BooksPage({ subjects, books, onEdit, onGoSchedule }: { subjects: string[]; books: BookMap; onEdit: (subject: string) => void; onGoSchedule: () => void }) {
  return (
    <section>
      <div className="page-heading"><div><p className="eyebrow">BOOKS</p><h2>课程与书籍</h2></div><span className="count-pill">{subjects.length} 门</span></div>
      <p className="page-intro">每门课设置一次，以后会自动生成每天的书包清单。</p>
      {subjects.length === 0 ? <div className="plain-empty"><BookOpen size={34} /><h3>还没有课程</h3><p>先去填写或上传课程表吧</p><button className="secondary-button" onClick={onGoSchedule}>去填写课程</button></div> : (
        <div className="book-list">{subjects.map((subject) => (
          <button className="book-row" key={subject} onClick={() => onEdit(subject)}><span className="subject-dot" style={{ background: subjectColor(subject) }} /><div><h3>{subject}</h3><p>{books[subject]?.length ? books[subject].join('、') : '尚未填写'}</p></div><Pencil size={18} /></button>
        ))}</div>
      )}
    </section>
  )
}

export function SettingsPage({ reminder, onReminderChange, onEnable, onDisable, onCalendar, onInstall, onReset, cloudStatus, pushStatus, isIos, isStandalone }: {
  reminder: ReminderSettings
  onReminderChange: (value: ReminderSettings) => void
  onEnable: () => void
  onDisable: () => void
  onCalendar: () => void
  onInstall: () => void
  onReset: () => void
  cloudStatus: string
  pushStatus: string
  isIos: boolean
  isStandalone: boolean
}) {
  return (
    <section>
      <div className="page-heading"><div><p className="eyebrow">PREFERENCES</p><h2>提醒设置</h2></div></div>
      <div className="setting-group">
        <div className="setting-row"><span className="setting-icon coral"><BellRing size={20} /></span><div><h3>每日提醒</h3><p>{pushStatus}</p></div><button className={reminder.enabled ? 'toggle active' : 'toggle'} onClick={() => reminder.enabled ? onDisable() : onEnable()} aria-label="切换每日提醒"><span /></button></div>
        <label className="setting-row"><span className="setting-icon yellow"><Clock3 size={20} /></span><div><h3>提醒时间</h3><p>建议晚饭后收拾书包</p></div><input className="time-input" type="time" value={reminder.time} onChange={(event) => onReminderChange({ ...reminder, time: event.target.value })} /></label>
      </div>
      <div className="info-card"><Bell size={18} /><p>{reminder.enabled ? `后台推送已启用${reminder.lastSent ? `，最近发送于 ${reminder.lastSent}` : ''}。` : '开启后，即使关闭应用也会按时推送明日书单。'}</p></div>
      <button className="secondary-button wide" onClick={onCalendar}><CalendarDays size={18} />添加到系统日历</button>
      <div className="section-title settings-title"><h3>在手机上使用</h3></div>
      <button className="setting-action" onClick={onInstall}><span className="setting-icon green"><Download size={20} /></span><div><h3>{isStandalone ? '已从手机桌面打开' : '安装到手机桌面'}</h3><p>{isIos && !isStandalone ? 'iPhone 需先安装，才能开启后台提醒' : '像普通 App 一样快速打开'}</p></div></button>
      <div className="section-title settings-title"><h3>数据</h3></div>
      <div className="cloud-status"><span className={cloudStatus.includes('已同步') ? 'status-dot online' : 'status-dot'} /><div><h3>匿名云端保存</h3><p>{cloudStatus}</p></div></div>
      <button className="danger-action" onClick={onReset}><Trash2 size={18} />清空课程与书籍</button>
      <p className="local-note">课程表图片不会上传；只有确认后的课程和书本名称会匿名保存。</p>
    </section>
  )
}

export function BookSheet({ subject, value, onClose, onSave }: { subject: string; value: string[]; onClose: () => void; onSave: (items: string[]) => void }) {
  const [items, setItems] = useState<string[]>(value)
  const [draft, setDraft] = useState('')
  const add = () => {
    const next = draft.trim()
    if (!next || items.includes(next)) return
    setItems([...items, next])
    setDraft('')
  }
  return (
    <div className="sheet-backdrop" role="dialog" aria-modal="true">
      <div className="sheet book-sheet"><div className="sheet-handle" /><div className="sheet-header"><div /><div><p className="eyebrow">PACKING LIST</p><h2>{subject}要带什么？</h2></div><button className="icon-button" onClick={onClose}><X size={21} /></button></div>
        <div className="sheet-body"><p className="page-intro">可以添加课本、练习册、文具或其他物品。</p><div className="add-book"><input autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') add() }} placeholder="例如：语文课本" /><button onClick={add}><Plus size={20} /></button></div>
        <div className="book-tags">{items.length ? items.map((item) => <span key={item}><BookOpen size={16} />{item}<button onClick={() => setItems(items.filter((valueItem) => valueItem !== item))}><X size={15} /></button></span>) : <div className="inline-empty">还没有添加物品</div>}</div>
        <button className="primary-button wide" onClick={() => onSave(items)}>保存</button></div>
      </div>
    </div>
  )
}
