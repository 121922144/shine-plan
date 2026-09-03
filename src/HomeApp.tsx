'use client'

import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { BookOpen, CalendarDays, Camera, Check, ClipboardList, Home, ImagePlus, Pencil, Pin, Plus, Settings, Share2, Sparkles, Trash2 } from 'lucide-react'
import { defaultHomeDay, homeTarget, type DateNote, type HomeDay, type ReminderSettings, type Slot } from './domain'

const loadDeferredViews = () => import('./features/DeferredViews')
const SchedulePage = lazy(() => loadDeferredViews().then((module) => ({ default: module.SchedulePage })))
const SettingsPage = lazy(() => loadDeferredViews().then((module) => ({ default: module.SettingsPage })))
const ImportSheet = lazy(() => import('./features/ImportSheet').then((module) => ({ default: module.ImportSheet })))

type Tab = 'home' | 'schedule' | 'settings'
type CloudState = { hasState: boolean; slots: Slot[]; notes: DateNote[]; reminder: ReminderSettings }

const COLORS = ['#f4b942', '#ef745c', '#79a7a0', '#7d8fc7', '#a97cba', '#d98c56']
const STORAGE = { slots: 'bag-plan.slots', notes: 'bag-plan.notes', reminder: 'bag-plan.reminder' }
const DEVICE_TOKEN_KEY = 'bag-plan.device-token'
const DEFAULT_REMINDER: ReminderSettings = { enabled: false, time: '20:00', lastSent: '' }
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

function readStored<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key)
    return value ? JSON.parse(value) as T : fallback
  } catch {
    return fallback
  }
}

async function apiRequest<T>(path: string, token = '', init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (token) headers.set('authorization', `Bearer ${token}`)
  if (init.body) headers.set('content-type', 'application/json')
  const response = await fetch(path, { ...init, headers })
  const data = await response.json().catch(() => ({})) as T & { error?: string }
  if (!response.ok) throw new Error(data.error || '云端服务暂时不可用')
  return data
}

function urlBase64ToArrayBuffer(value: string) {
  const padding = '='.repeat((4 - value.length % 4) % 4)
  const base64 = (value + padding).replaceAll('-', '+').replaceAll('_', '/')
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0)).buffer
}

function subjectColor(subject: string) {
  let score = 0
  for (const char of subject) score += char.charCodeAt(0)
  return COLORS[score % COLORS.length]
}

function HomeSkeleton() {
  return <div className="home-skeleton" aria-label="正在读取课程"><div className="skeleton-hero" /><div className="skeleton-line skeleton-label" /><div className="skeleton-line skeleton-title" /><div className="skeleton-line skeleton-title short" /><div className="skeleton-line skeleton-copy" /><div className="skeleton-line skeleton-copy short" /><div className="skeleton-button" /></div>
}

function PanelSkeleton() {
  return <div className="panel-skeleton" aria-label="正在打开"><div /><div /><div /><div /></div>
}

function NavButton({ active, label, icon, onClick }: { active: boolean; label: string; icon: React.ReactNode; onClick: () => void }) {
  return <button className={active ? 'nav-button active' : 'nav-button'} onClick={onClick}>{icon}<span>{label}</span></button>
}

function SmartHome({ allSlots, notes, selectedDay, onSelectedDay, onNotesChange, onImport, onShare }: {
  allSlots: Slot[]
  notes: DateNote[]
  selectedDay: HomeDay
  onSelectedDay: (day: HomeDay) => void
  onNotesChange: (notes: DateNote[]) => void
  onImport: () => void
  onShare: () => void
}) {
  const now = new Date()
  const target = homeTarget(now, selectedDay)
  const slots = allSlots.filter((slot) => slot.day === target.weekday).sort((a, b) => a.period - b.period)
  const dayNotes = notes.filter((note) => note.date === target.dateKey)
  const [draft, setDraft] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)

  const saveNote = () => {
    const text = draft.trim()
    if (!text) return
    if (editingId) onNotesChange(notes.map((note) => note.id === editingId ? { ...note, text } : note))
    else onNotesChange([...notes, { id: uid(), date: target.dateKey, text }])
    setDraft('')
    setEditingId(null)
  }
  const beginEdit = (note: DateNote) => { setEditingId(note.id); setDraft(note.text) }
  const cancelEdit = () => { setEditingId(null); setDraft('') }

  if (!allSlots.length) return (
    <section className="empty-hero">
      <div className="hero-illustration"><div className="sun-dot" /><div className="backpack"><span /><span /><span /></div></div>
      <p className="eyebrow">从一张照片开始</p>
      <h2>打开就知道，<br />今天明天上什么课。</h2>
      <p className="muted">上传课程表，识别后可以直接校对和修改。</p>
      <button className="primary-button wide" onClick={onImport}><Camera size={19} />上传课程表</button>
      <div className="privacy-note"><Sparkles size={16} /><span>图片只在你的设备上识别，不会保存到服务器</span></div>
    </section>
  )

  return (
    <section>
      <div className="home-day-switch" aria-label="选择查看日期">
        <button className={selectedDay === 'today' ? 'active' : ''} onClick={() => { onSelectedDay('today'); cancelEdit() }}>今天</button>
        <button className={selectedDay === 'tomorrow' ? 'active' : ''} onClick={() => { onSelectedDay('tomorrow'); cancelEdit() }}>明天</button>
      </div>
      <div className="tomorrow-heading"><div><p className="eyebrow">{selectedDay === 'today' ? 'TODAY' : 'TOMORROW'}</p><h2>{target.label} · {target.weekdayLabel}</h2><p>{target.date.getMonth() + 1}月{target.date.getDate()}日</p></div><button className="round-share" onClick={onShare} aria-label={`分享${target.label}课程`}><Share2 size={20} /></button></div>
      <div className="summary-card"><div><strong>{slots.length}</strong><span>节课</span></div><div className="summary-copy">{slots.length ? `${target.label}的课程已按节次排好` : `${target.label}没有安排课程`}</div><div className="summary-check"><Check size={20} /></div></div>
      <div className="section-title"><h3>按上课顺序</h3><span>{slots.length ? `共 ${slots.length} 节课` : ''}</span></div>
      {slots.length === 0 ? <div className="day-off"><span>☁️</span><h3>{target.label}没有课程</h3><p>有临时要准备的东西，可以记在下面</p></div> : (
        <div className="course-list">{slots.map((slot) => <div className="course-card" key={slot.id}><div className="period-badge" style={{ background: subjectColor(slot.name) }}>第<br /><strong>{slot.period}</strong><br />节</div><div className="course-info"><h3>{slot.name}</h3><p>第 {slot.period} 节课</p></div></div>)}</div>
      )}

      <div className="notes-panel">
        <div className="section-title notes-title"><h3><Pin size={16} />{target.label}提醒</h3><span>按日期保存</span></div>
        {dayNotes.length ? <div className="note-list">{dayNotes.map((note) => <div className="note-row" key={note.id}><span>{note.text}</span><button onClick={() => beginEdit(note)} aria-label={`修改${note.text}`}><Pencil size={16} /></button><button onClick={() => { onNotesChange(notes.filter((item) => item.id !== note.id)); if (editingId === note.id) cancelEdit() }} aria-label={`删除${note.text}`}><Trash2 size={16} /></button></div>)}</div> : <div className="note-empty"><ClipboardList size={22} /><span>还没有临时提醒</span></div>}
        <div className="note-editor"><input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') saveNote() }} placeholder={editingId ? '修改提醒内容' : '例如：美术课带彩笔'} maxLength={80} /><button onClick={saveNote} disabled={!draft.trim()} aria-label={editingId ? '保存修改' : '添加提醒'}>{editingId ? <Check size={19} /> : <Plus size={19} />}</button></div>
        {editingId && <button className="cancel-note" onClick={cancelEdit}>取消修改</button>}
      </div>
    </section>
  )
}

export default function HomeApp() {
  const [booted, setBooted] = useState(false)
  const [tab, setTab] = useState<Tab>('home')
  const [selectedDay, setSelectedDay] = useState<HomeDay>('today')
  const [slots, setSlots] = useState<Slot[]>([])
  const [notes, setNotes] = useState<DateNote[]>([])
  const [reminder, setReminder] = useState<ReminderSettings>(DEFAULT_REMINDER)
  const [importOpen, setImportOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [installPrompt, setInstallPrompt] = useState<any>(null)
  const [cloudReady, setCloudReady] = useState(false)
  const [cloudStatus, setCloudStatus] = useState('正在连接云端…')
  const [pushStatus, setPushStatus] = useState('尚未开启')
  const [isIos, setIsIos] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    const localSlots = readStored<Slot[]>(STORAGE.slots, [])
    const localNotes = readStored<DateNote[]>(STORAGE.notes, [])
    const localReminder = readStored<ReminderSettings>(STORAGE.reminder, DEFAULT_REMINDER)
    setSlots(localSlots); setNotes(localNotes); setReminder(localReminder)
    setSelectedDay(defaultHomeDay(new Date()))
    setBooted(true)

    const onInstall = (event: Event) => { event.preventDefault(); setInstallPrompt(event) }
    window.addEventListener('beforeinstallprompt', onInstall)
    setIsIos(/iphone|ipad|ipod/i.test(navigator.userAgent))
    setIsStandalone(window.matchMedia('(display-mode: standalone)').matches || ('standalone' in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone)))
    const registerWorker = () => navigator.serviceWorker?.register('/sw.js').catch(() => undefined)
    const idleWindow = window as Window & { requestIdleCallback?: (callback: () => void) => number; cancelIdleCallback?: (id: number) => void }
    const idleId = idleWindow.requestIdleCallback ? idleWindow.requestIdleCallback(registerWorker) : window.setTimeout(registerWorker, 250)

    let cancelled = false
    const syncCloud = async () => {
      try {
        let token = localStorage.getItem(DEVICE_TOKEN_KEY) || ''
        if (!token) {
          const created = await apiRequest<{ token: string }>('/api/device', '', { method: 'POST' })
          token = created.token; localStorage.setItem(DEVICE_TOKEN_KEY, token)
        }
        let state: CloudState
        try { state = await apiRequest<CloudState>('/api/state', token) }
        catch (error) {
          if (!(error instanceof Error) || !error.message.includes('凭证')) throw error
          localStorage.removeItem(DEVICE_TOKEN_KEY)
          const created = await apiRequest<{ token: string }>('/api/device', '', { method: 'POST' })
          token = created.token; localStorage.setItem(DEVICE_TOKEN_KEY, token)
          state = await apiRequest<CloudState>('/api/state', token)
        }
        if (cancelled) return
        if (state.hasState) {
          setSlots(state.slots); setNotes(state.notes ?? []); setReminder(state.reminder)
        } else {
          await apiRequest('/api/state', token, { method: 'PUT', body: JSON.stringify({ slots: localSlots, notes: localNotes, reminder: localReminder, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai' }) })
        }
        setCloudReady(true); setCloudStatus('已同步到云端'); setPushStatus(state.reminder.enabled ? '后台提醒已开启' : '尚未开启')
      } catch { if (!cancelled) setCloudStatus('当前离线，数据已保存在手机') }
    }
    syncCloud()
    return () => {
      cancelled = true; window.removeEventListener('beforeinstallprompt', onInstall)
      if (idleWindow.cancelIdleCallback) idleWindow.cancelIdleCallback(idleId)
      else window.clearTimeout(idleId)
    }
  }, [])

  useEffect(() => { if (booted) localStorage.setItem(STORAGE.slots, JSON.stringify(slots)) }, [booted, slots])
  useEffect(() => { if (booted) localStorage.setItem(STORAGE.notes, JSON.stringify(notes)) }, [booted, notes])
  useEffect(() => { if (booted) localStorage.setItem(STORAGE.reminder, JSON.stringify(reminder)) }, [booted, reminder])
  useEffect(() => {
    if (!cloudReady) return
    const timer = window.setTimeout(async () => {
      const token = localStorage.getItem(DEVICE_TOKEN_KEY) || ''
      if (!token) return
      setCloudStatus('正在同步…')
      try {
        await apiRequest('/api/state', token, { method: 'PUT', body: JSON.stringify({ slots, notes, reminder: { enabled: reminder.enabled, time: reminder.time }, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai' }) })
        setCloudStatus('已同步到云端')
      } catch { setCloudStatus('同步失败，联网后请重新打开应用') }
    }, 700)
    return () => window.clearTimeout(timer)
  }, [cloudReady, slots, notes, reminder.enabled, reminder.time])
  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 2400)
    return () => window.clearTimeout(timer)
  }, [toast])

  const target = homeTarget(new Date(), selectedDay)
  const selectedSlots = useMemo(() => slots.filter((slot) => slot.day === target.weekday).sort((a, b) => a.period - b.period), [slots, target.weekday])
  const selectedNotes = useMemo(() => notes.filter((note) => note.date === target.dateKey), [notes, target.dateKey])
  const showToast = (message: string) => setToast(message)

  const enableReminder = async () => {
    if (isIos && !isStandalone) return showToast('请先添加到主屏幕，再从桌面打开并开启提醒')
    if (!('Notification' in window)) return showToast('当前浏览器不支持通知')
    try {
      const token = localStorage.getItem(DEVICE_TOKEN_KEY) || ''
      if (!token) throw new Error('云端连接尚未完成，请稍后重试')
      if (await Notification.requestPermission() !== 'granted') throw new Error('需要允许通知才能提醒你')
      const registration = await navigator.serviceWorker.ready
      const config = await apiRequest<{ pushAvailable: boolean; vapidPublicKey: string }>('/api/config')
      if (!config.pushAvailable) throw new Error('推送服务尚未配置完成')
      const existing = await registration.pushManager.getSubscription()
      const subscription = existing || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToArrayBuffer(config.vapidPublicKey) })
      await apiRequest('/api/push-subscriptions', token, { method: 'POST', body: JSON.stringify(subscription.toJSON()) })
      setReminder((value) => ({ ...value, enabled: true })); setPushStatus('后台提醒已开启'); showToast('提醒已开启，测试通知已发送')
    } catch (error) { showToast(error instanceof Error ? error.message : '提醒开启失败') }
  }

  const disableReminder = async () => {
    setReminder((value) => ({ ...value, enabled: false })); setPushStatus('尚未开启')
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      const token = localStorage.getItem(DEVICE_TOKEN_KEY) || ''
      if (token) await apiRequest('/api/push-subscriptions', token, { method: 'DELETE', body: JSON.stringify({ endpoint: subscription?.endpoint }) })
      await subscription?.unsubscribe(); showToast('提醒已关闭')
    } catch { showToast('提醒已关闭，云端状态稍后同步') }
  }

  const shareCurrentDay = async () => {
    const courseText = selectedSlots.length ? selectedSlots.map((slot) => `第${slot.period}节 ${slot.name}`).join('\n') : `${target.label}没有课程`
    const noteText = selectedNotes.length ? `\n${target.label}提醒：${selectedNotes.map((note) => note.text).join('、')}` : ''
    const text = `${target.label}课程（${target.weekdayLabel}）\n${courseText}${noteText}`
    if (navigator.share) await navigator.share({ title: `${target.label}课程`, text })
    else { await navigator.clipboard.writeText(text); showToast('课程已复制') }
  }

  const installApp = async () => {
    if (installPrompt) { await installPrompt.prompt(); setInstallPrompt(null); return }
    showToast('请在浏览器菜单中选择“添加到主屏幕”')
  }

  const downloadCalendar = () => {
    const [hour, minute] = reminder.time.split(':').map(Number)
    const start = new Date(); start.setDate(start.getDate() + 1); start.setHours(hour, minute, 0, 0)
    const stamp = start.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
    const end = new Date(start.getTime() + 600000).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Bag Plan//CN', 'BEGIN:VEVENT', `UID:${uid()}@bag-plan`, `DTSTART:${stamp}`, `DTEND:${end}`, 'RRULE:FREQ=DAILY', 'SUMMARY:查看明天课程', 'DESCRIPTION:打开“书包计划”查看明天的课程和临时提醒。', 'BEGIN:VALARM', 'TRIGGER:-PT0M', 'ACTION:DISPLAY', 'DESCRIPTION:该查看明天的课程啦', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n')
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' })); link.download = '书包计划-每日课程提醒.ics'; link.click(); URL.revokeObjectURL(link.href); showToast('日历提醒已生成')
  }

  return (
    <div className="app-shell">
      <main className="phone-frame">
        <header className="topbar"><div className="brand-mark"><BookOpen size={20} strokeWidth={2.4} /></div><div><p className="eyebrow">BAG PLAN</p><h1>书包计划</h1></div><button className="icon-button" aria-label="上传课程表" onClick={() => setImportOpen(true)}><ImagePlus size={21} /></button></header>
        <div className="page-content">
          {!booted ? <HomeSkeleton /> : tab === 'home' ? <SmartHome allSlots={slots} notes={notes} selectedDay={selectedDay} onSelectedDay={setSelectedDay} onNotesChange={setNotes} onImport={() => setImportOpen(true)} onShare={shareCurrentDay} /> : (
            <Suspense fallback={<PanelSkeleton />}>
              {tab === 'schedule' && <SchedulePage slots={slots} onChange={setSlots} onImport={() => setImportOpen(true)} />}
              {tab === 'settings' && <SettingsPage reminder={reminder} onReminderChange={setReminder} onEnable={enableReminder} onDisable={disableReminder} onCalendar={downloadCalendar} onInstall={installApp} cloudStatus={cloudStatus} pushStatus={pushStatus} isIos={isIos} isStandalone={isStandalone} onReset={() => { if (!window.confirm('确定清空课程和日期提醒吗？此操作无法撤销。')) return; setSlots([]); setNotes([]); showToast('数据已清空') }} />}
            </Suspense>
          )}
        </div>
        <nav className="bottom-nav" aria-label="主导航"><NavButton active={tab === 'home'} label="首页" icon={<Home />} onClick={() => setTab('home')} /><NavButton active={tab === 'schedule'} label="课表" icon={<CalendarDays />} onClick={() => setTab('schedule')} /><NavButton active={tab === 'settings'} label="设置" icon={<Settings />} onClick={() => setTab('settings')} /></nav>
      </main>
      {importOpen && <Suspense fallback={<div className="sheet-backdrop"><div className="sheet sheet-loading"><PanelSkeleton /></div></div>}><ImportSheet currentSlots={slots} onClose={() => setImportOpen(false)} onSave={(nextSlots, mode) => { setSlots(mode === 'replace' ? nextSlots : [...slots, ...nextSlots]); setImportOpen(false); setTab('schedule'); showToast('课程表已保存') }} /></Suspense>}
      {toast && <div className="toast"><Check size={17} />{toast}</div>}
    </div>
  )
}
