'use client'

import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { BookOpen, CalendarDays, Camera, Check, ImagePlus, PackageCheck, Pencil, Settings, Share2, Sparkles } from 'lucide-react'
import type { BookMap, ReminderSettings, Slot } from './features/DeferredViews'

const loadDeferredViews = () => import('./features/DeferredViews')
const SchedulePage = lazy(() => loadDeferredViews().then((module) => ({ default: module.SchedulePage })))
const BooksPage = lazy(() => loadDeferredViews().then((module) => ({ default: module.BooksPage })))
const SettingsPage = lazy(() => loadDeferredViews().then((module) => ({ default: module.SettingsPage })))
const BookSheet = lazy(() => loadDeferredViews().then((module) => ({ default: module.BookSheet })))
const ImportSheet = lazy(() => import('./App').then((module) => ({ default: module.ImportSheet })))

type Tab = 'tomorrow' | 'schedule' | 'books' | 'settings'
type CloudState = { hasState: boolean; slots: Slot[]; books: BookMap; reminder: ReminderSettings }

const DAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const COLORS = ['#f4b942', '#ef745c', '#79a7a0', '#7d8fc7', '#a97cba', '#d98c56']
const STORAGE = { slots: 'bag-plan.slots', books: 'bag-plan.books', reminder: 'bag-plan.reminder' }
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

function getTomorrowLabel() {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  return `${date.getMonth() + 1}月${date.getDate()}日 · ${DAY_NAMES[date.getDay()]}`
}

function HomeSkeleton() {
  return (
    <div className="home-skeleton" aria-label="正在读取明日课程">
      <div className="skeleton-hero" />
      <div className="skeleton-line skeleton-label" />
      <div className="skeleton-line skeleton-title" />
      <div className="skeleton-line skeleton-title short" />
      <div className="skeleton-line skeleton-copy" />
      <div className="skeleton-line skeleton-copy short" />
      <div className="skeleton-button" />
    </div>
  )
}

function PanelSkeleton() {
  return <div className="panel-skeleton" aria-label="正在打开"><div /><div /><div /><div /></div>
}

function NavButton({ active, label, icon, onClick }: { active: boolean; label: string; icon: React.ReactNode; onClick: () => void }) {
  return <button className={active ? 'nav-button active' : 'nav-button'} onClick={onClick}>{icon}<span>{label}</span></button>
}

function TomorrowPage({ slots, books, hasSchedule, missingCount, onImport, onEditBook, onShare, onOpenBooks }: {
  slots: Slot[]; books: BookMap; hasSchedule: boolean; missingCount: number; onImport: () => void; onEditBook: (name: string) => void; onShare: () => void; onOpenBooks: () => void
}) {
  const totalItems = slots.reduce((sum, slot) => sum + (books[slot.name]?.length ?? 0), 0)
  if (!hasSchedule) return (
    <section className="empty-hero">
      <div className="hero-illustration"><div className="sun-dot" /><div className="backpack"><span /><span /><span /></div></div>
      <p className="eyebrow">从一张照片开始</p>
      <h2>明天上什么课，<br />今晚就收拾好。</h2>
      <p className="muted">上传课程表，确认每门课要带的书。之后每天打开就能看到明日清单。</p>
      <button className="primary-button wide" onClick={onImport}><Camera size={19} />上传课程表</button>
      <div className="privacy-note"><Sparkles size={16} /><span>图片只在你的设备上识别，不会保存到服务器</span></div>
    </section>
  )
  return (
    <section>
      <div className="tomorrow-heading"><div><p className="eyebrow">TOMORROW</p><h2>明日书包</h2><p>{getTomorrowLabel()}</p></div><button className="round-share" onClick={onShare} aria-label="分享明日清单"><Share2 size={20} /></button></div>
      <div className="summary-card"><div><strong>{slots.length}</strong><span>门课程</span></div><div className="summary-divider" /><div><strong>{totalItems}</strong><span>本 / 件物品</span></div><div className="summary-check"><Check size={20} /></div></div>
      {missingCount > 0 && <button className="warning-card" onClick={onOpenBooks}><span>还有 {missingCount} 门课没填写书籍</span><Pencil size={17} /></button>}
      <div className="section-title"><h3>按上课顺序</h3><span>{slots.length ? '轻点可编辑书籍' : ''}</span></div>
      {slots.length === 0 ? <div className="day-off"><span>☁️</span><h3>明天没有课程</h3><p>书包可以休息一天啦</p></div> : (
        <div className="course-list">{slots.map((slot) => <button className="course-card" key={slot.id} onClick={() => onEditBook(slot.name)}><div className="period-badge" style={{ background: subjectColor(slot.name) }}>第<br /><strong>{slot.period}</strong><br />节</div><div className="course-info"><h3>{slot.name}</h3><p>{books[slot.name]?.length ? books[slot.name].join(' · ') : '点击填写要带的书'}</p></div><Pencil size={17} /></button>)}</div>
      )}
    </section>
  )
}

export default function HomeApp() {
  const [booted, setBooted] = useState(false)
  const [tab, setTab] = useState<Tab>('tomorrow')
  const [slots, setSlots] = useState<Slot[]>([])
  const [books, setBooks] = useState<BookMap>({})
  const [reminder, setReminder] = useState<ReminderSettings>(DEFAULT_REMINDER)
  const [importOpen, setImportOpen] = useState(false)
  const [editingSubject, setEditingSubject] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const [installPrompt, setInstallPrompt] = useState<any>(null)
  const [cloudReady, setCloudReady] = useState(false)
  const [cloudStatus, setCloudStatus] = useState('正在连接云端…')
  const [pushStatus, setPushStatus] = useState('尚未开启')
  const [isIos, setIsIos] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    const localSlots = readStored<Slot[]>(STORAGE.slots, [])
    const localBooks = readStored<BookMap>(STORAGE.books, {})
    const localReminder = readStored<ReminderSettings>(STORAGE.reminder, DEFAULT_REMINDER)
    setSlots(localSlots)
    setBooks(localBooks)
    setReminder(localReminder)
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
          token = created.token
          localStorage.setItem(DEVICE_TOKEN_KEY, token)
        }
        let state: CloudState
        try {
          state = await apiRequest<CloudState>('/api/state', token)
        } catch (error) {
          if (!(error instanceof Error) || !error.message.includes('凭证')) throw error
          localStorage.removeItem(DEVICE_TOKEN_KEY)
          const created = await apiRequest<{ token: string }>('/api/device', '', { method: 'POST' })
          token = created.token
          localStorage.setItem(DEVICE_TOKEN_KEY, token)
          state = await apiRequest<CloudState>('/api/state', token)
        }
        if (cancelled) return
        if (state.hasState) {
          setSlots(state.slots); setBooks(state.books); setReminder(state.reminder)
        } else {
          await apiRequest('/api/state', token, { method: 'PUT', body: JSON.stringify({ slots: localSlots, books: localBooks, reminder: localReminder, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai' }) })
        }
        setCloudReady(true)
        setCloudStatus('已同步到云端')
        setPushStatus(state.reminder.enabled ? '后台提醒已开启' : '尚未开启')
      } catch {
        if (!cancelled) setCloudStatus('当前离线，数据已保存在手机')
      }
    }
    syncCloud()
    return () => {
      cancelled = true
      window.removeEventListener('beforeinstallprompt', onInstall)
      if (idleWindow.cancelIdleCallback) idleWindow.cancelIdleCallback(idleId)
      else window.clearTimeout(idleId)
    }
  }, [])

  useEffect(() => { if (booted) localStorage.setItem(STORAGE.slots, JSON.stringify(slots)) }, [booted, slots])
  useEffect(() => { if (booted) localStorage.setItem(STORAGE.books, JSON.stringify(books)) }, [booted, books])
  useEffect(() => { if (booted) localStorage.setItem(STORAGE.reminder, JSON.stringify(reminder)) }, [booted, reminder])
  useEffect(() => {
    if (!cloudReady) return
    const timer = window.setTimeout(async () => {
      const token = localStorage.getItem(DEVICE_TOKEN_KEY) || ''
      if (!token) return
      setCloudStatus('正在同步…')
      try {
        await apiRequest('/api/state', token, { method: 'PUT', body: JSON.stringify({ slots, books, reminder: { enabled: reminder.enabled, time: reminder.time }, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai' }) })
        setCloudStatus('已同步到云端')
      } catch { setCloudStatus('同步失败，联网后请重新打开应用') }
    }, 700)
    return () => window.clearTimeout(timer)
  }, [cloudReady, slots, books, reminder.enabled, reminder.time])
  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 2400)
    return () => window.clearTimeout(timer)
  }, [toast])

  const tomorrowDay = (new Date().getDay() + 1) % 7
  const tomorrowSlots = useMemo(() => slots.filter((slot) => slot.day === tomorrowDay).sort((a, b) => a.period - b.period), [slots, tomorrowDay])
  const subjects = useMemo(() => Array.from(new Set(slots.map((slot) => slot.name))).filter(Boolean).sort((a, b) => a.localeCompare(b, 'zh-CN')), [slots])
  const missingBookSubjects = subjects.filter((subject) => !books[subject]?.length)
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

  const shareTomorrow = async () => {
    const lines = tomorrowSlots.map((slot) => `第${slot.period}节 ${slot.name}：${books[slot.name]?.length ? books[slot.name].join('、') : '还没填写书籍'}`)
    const text = `明日书包清单（${getTomorrowLabel()}）\n${lines.length ? lines.join('\n') : '明天没有课程'}`
    if (navigator.share) await navigator.share({ title: '明日书包清单', text })
    else { await navigator.clipboard.writeText(text); showToast('清单已复制') }
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
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Bag Plan//CN', 'BEGIN:VEVENT', `UID:${uid()}@bag-plan`, `DTSTART:${stamp}`, `DTEND:${end}`, 'RRULE:FREQ=DAILY', 'SUMMARY:收拾明天的书包', 'DESCRIPTION:打开“书包计划”查看明天要带的书。', 'BEGIN:VALARM', 'TRIGGER:-PT0M', 'ACTION:DISPLAY', 'DESCRIPTION:该收拾明天的书包啦', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n')
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' })); link.download = '书包计划-每日提醒.ics'; link.click(); URL.revokeObjectURL(link.href); showToast('日历提醒已生成')
  }

  return (
    <div className="app-shell">
      <main className="phone-frame">
        <header className="topbar"><div className="brand-mark"><BookOpen size={20} strokeWidth={2.4} /></div><div><p className="eyebrow">BAG PLAN</p><h1>书包计划</h1></div><button className="icon-button" aria-label="上传课程表" onClick={() => setImportOpen(true)}><ImagePlus size={21} /></button></header>
        <div className="page-content">
          {!booted ? <HomeSkeleton /> : tab === 'tomorrow' ? <TomorrowPage slots={tomorrowSlots} books={books} hasSchedule={slots.length > 0} missingCount={missingBookSubjects.length} onImport={() => setImportOpen(true)} onEditBook={setEditingSubject} onShare={shareTomorrow} onOpenBooks={() => setTab('books')} /> : (
            <Suspense fallback={<PanelSkeleton />}>
              {tab === 'schedule' && <SchedulePage slots={slots} onChange={setSlots} onImport={() => setImportOpen(true)} />}
              {tab === 'books' && <BooksPage subjects={subjects} books={books} onEdit={setEditingSubject} onGoSchedule={() => setTab('schedule')} />}
              {tab === 'settings' && <SettingsPage reminder={reminder} onReminderChange={setReminder} onEnable={enableReminder} onDisable={disableReminder} onCalendar={downloadCalendar} onInstall={installApp} cloudStatus={cloudStatus} pushStatus={pushStatus} isIos={isIos} isStandalone={isStandalone} onReset={() => { if (!window.confirm('确定清空课程表和书籍吗？此操作无法撤销。')) return; setSlots([]); setBooks({}); showToast('数据已清空') }} />}
            </Suspense>
          )}
        </div>
        <nav className="bottom-nav" aria-label="主导航"><NavButton active={tab === 'tomorrow'} label="明日" icon={<PackageCheck />} onClick={() => setTab('tomorrow')} /><NavButton active={tab === 'schedule'} label="课表" icon={<CalendarDays />} onClick={() => setTab('schedule')} /><NavButton active={tab === 'books'} label="书籍" icon={<BookOpen />} onClick={() => setTab('books')} /><NavButton active={tab === 'settings'} label="设置" icon={<Settings />} onClick={() => setTab('settings')} /></nav>
      </main>
      {importOpen && <Suspense fallback={<div className="sheet-backdrop"><div className="sheet sheet-loading"><PanelSkeleton /></div></div>}><ImportSheet currentSlots={slots} onClose={() => setImportOpen(false)} onSave={(nextSlots, mode) => { setSlots(mode === 'replace' ? nextSlots : [...slots, ...nextSlots]); setImportOpen(false); setTab('schedule'); showToast('课程表已保存') }} /></Suspense>}
      {editingSubject && <Suspense fallback={null}><BookSheet subject={editingSubject} value={books[editingSubject] ?? []} onClose={() => setEditingSubject(null)} onSave={(items) => { setBooks((value) => ({ ...value, [editingSubject]: items })); setEditingSubject(null); showToast('书籍已保存') }} /></Suspense>}
      {toast && <div className="toast"><Check size={17} />{toast}</div>}
    </div>
  )
}
