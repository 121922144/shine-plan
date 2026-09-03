'use client'

import { useState } from 'react'
import { Bell, BellRing, CalendarDays, Clock3, Download, Trash2, Upload } from 'lucide-react'
import type { ReminderSettings, Slot } from '../domain'

export type { ReminderSettings, Slot } from '../domain'

const DAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const SCHOOL_DAYS = [1, 2, 3, 4, 5]
const PERIODS = Array.from({ length: 8 }, (_, index) => index + 1)
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

export function SchedulePage({ slots, onChange, onImport }: { slots: Slot[]; onChange: (slots: Slot[]) => void; onImport: () => void }) {
  const [day, setDay] = useState(Math.min(5, Math.max(1, new Date().getDay())))
  const getSlot = (period: number) => slots.find((slot) => slot.day === day && slot.period === period)
  const update = (period: number, name: string) => {
    const current = getSlot(period)
    if (current) onChange(name.trim() ? slots.map((slot) => slot.id === current.id ? { ...slot, name } : slot) : slots.filter((slot) => slot.id !== current.id))
    else if (name.trim()) onChange([...slots, { id: uid(), day, period, name }])
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
        <label className="setting-row"><span className="setting-icon yellow"><Clock3 size={20} /></span><div><h3>提醒时间</h3><p>按设定时间提醒明天课程</p></div><input className="time-input" type="time" value={reminder.time} onChange={(event) => onReminderChange({ ...reminder, time: event.target.value })} /></label>
      </div>
      <div className="info-card"><Bell size={18} /><p>{reminder.enabled ? `后台推送已启用${reminder.lastSent ? `，最近发送于 ${reminder.lastSent}` : ''}。` : '开启后，即使关闭应用也会按时推送明天的课程和临时提醒。'}</p></div>
      <button className="secondary-button wide" onClick={onCalendar}><CalendarDays size={18} />添加到系统日历</button>
      <div className="section-title settings-title"><h3>在手机上使用</h3></div>
      <button className="setting-action" onClick={onInstall}><span className="setting-icon green"><Download size={20} /></span><div><h3>{isStandalone ? '已从手机桌面打开' : '安装到手机桌面'}</h3><p>{isIos && !isStandalone ? 'iPhone 需先安装，才能开启后台提醒' : '像普通 App 一样快速打开'}</p></div></button>
      <div className="section-title settings-title"><h3>数据</h3></div>
      <div className="cloud-status"><span className={cloudStatus.includes('已同步') ? 'status-dot online' : 'status-dot'} /><div><h3>匿名云端保存</h3><p>{cloudStatus}</p></div></div>
      <button className="danger-action" onClick={onReset}><Trash2 size={18} />清空课程与日期提醒</button>
      <p className="local-note">课程表图片不会上传；只有确认后的课程和日期提醒会匿名保存。</p>
    </section>
  )
}
