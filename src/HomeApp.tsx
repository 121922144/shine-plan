'use client'

import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { CalendarDays, Camera, Check, Home, Settings, Sparkles } from 'lucide-react'
import { HomeHero } from './components/home/HomeHero'
import { DailyGoalsCard } from './components/home/DailyGoalsCard'
import { HomeCourseCard } from './components/home/HomeCourseCard'
import { resolveCourseIcon } from './features/home/courseIconMap'
import { StarRewardBanner } from './components/home/StarRewardBanner'
import { mockCourseStatuses } from './features/home/homeMock'
import { defaultHomeDay, homeTarget, type DateNote, type HomeDay, type ReminderSettings, type Slot } from './domain'

const loadDeferredViews = () => import('./features/DeferredViews')
const SchedulePage = lazy(() => loadDeferredViews().then((module) => ({ default: module.SchedulePage })))
const SettingsPage = lazy(() => loadDeferredViews().then((module) => ({ default: module.SettingsPage })))
const ImportSheet = lazy(() => import('./features/ImportSheet').then((module) => ({ default: module.ImportSheet })))

type Tab = 'home' | 'schedule' | 'settings'
type CloudState = { hasState: boolean; slots: Slot[]; notes: DateNote[]; reminder: ReminderSettings }

const STORAGE = { slots: 'bag-plan.slots', notes: 'bag-plan.notes', reminder: 'bag-plan.reminder' }
const DEVICE_TOKEN_KEY = 'bag-plan.device-token'
const DEFAULT_REMINDER: ReminderSettings = { enabled: false, time: '20:00', lastSent: '' }
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
const cloudApiConfigured = import.meta.env.MODE !== 'vercel' || Boolean(API_BASE_URL)
const missingReminderServiceMessage = '当前预览版尚未配置独立提醒服务，可先使用「添加到系统日历」'
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
let deviceTokenPromise: Promise<string> | null = null

async function ensureDeviceToken() {
  const existing = localStorage.getItem(DEVICE_TOKEN_KEY) || ''
  if (existing) return existing
  if (!deviceTokenPromise) {
    deviceTokenPromise = apiRequest<{ token: string }>('/api/device', '', { method: 'POST' })
      .then(({ token }) => {
        if (!token || typeof token !== 'string') throw new Error('云端设备接口返回异常，请检查 API 后端')
        localStorage.setItem(DEVICE_TOKEN_KEY, token)
        return token
      })
      .finally(() => {
        deviceTokenPromise = null
      })
  }
  return deviceTokenPromise
}

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
  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers })
  const isJson = response.headers.get('content-type')?.includes('application/json')
  const data = isJson ? await response.json().catch(() => ({})) as T & { error?: string } : ({} as T & { error?: string })
  if (!response.ok) {
    const explanation = response.status === 404
      ? '云端接口不存在，请检查独立 API 地址和部署'
      : response.status >= 500
        ? '云端接口异常，请检查后端服务及数据库配置'
        : `云端请求失败（${response.status}）`
    throw new Error(data.error || explanation)
  }
  if (!isJson) throw new Error('云端接口未正确连接，返回的不是接口数据')
  return data
}

function urlBase64ToArrayBuffer(value: string) {
  const padding = '='.repeat((4 - value.length % 4) % 4)
  const base64 = (value + padding).replaceAll('-', '+').replaceAll('_', '/')
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0)).buffer
}

function HomeSkeleton() {
  return <div className="home-skeleton shine-home-skeleton" aria-label="正在读取课程"><HomeHero loading /><div className="skeleton-task" /><div className="skeleton-section"><div /><div /><div /></div></div>
}

function PanelSkeleton() {
  return <div className="panel-skeleton" aria-label="正在打开"><div /><div /><div /><div /></div>
}

function ScheduleSkeleton() {
  return <section className="schedule-page schedule-skeleton" aria-label="正在打开课表" aria-busy="true">
    <section className="schedule-banner">
      <img className="schedule-banner-art" src="/assets/banners/schedule-banner.png" alt="" />
      <div className="schedule-banner-copy"><h1>我的课表</h1><p>每一天，都安排得闪闪发光</p></div>
    </section>
    <div className="schedule-content" aria-hidden="true">
      <div className="schedule-date-card schedule-skeleton-calendar">
        <div className="schedule-skeleton-month"><span /><i /><span /></div>
        <div className="schedule-skeleton-week">{Array.from({ length: 7 }, (_, index) => <div key={index}><i /><b /></div>)}</div>
      </div>
      <div className="schedule-skeleton-heading"><div><i /><i /></div><span /></div>
      <div className="schedule-course-list">{Array.from({ length: 3 }, (_, index) => <div className="schedule-course-card schedule-skeleton-course" key={index}><span className="schedule-skeleton-badge" /><span className="schedule-skeleton-icon" /><span className="schedule-skeleton-lines"><i /><i /></span><span className="schedule-skeleton-status" /></div>)}</div>
    </div>
  </section>
}

function NavButton({ active, label, icon, onClick }: { active: boolean; label: string; icon: React.ReactNode; onClick: () => void }) {
  return <button className={active ? 'nav-button active' : 'nav-button'} onClick={onClick}>{icon}<span>{label}</span></button>
}

function SmartHome({ allSlots, selectedDay, onSelectedDay, onImport }: {
  allSlots: Slot[]
  selectedDay: HomeDay
  onSelectedDay: (day: HomeDay) => void
  onImport: () => void
}) {
  const now = new Date()
  const target = homeTarget(now, selectedDay)
  const slots = allSlots.filter((slot) => slot.day === target.weekday).sort((a, b) => a.period - b.period)
  const [prepared, setPrepared] = useState(false)

  return (
    <section className="home-page shine-home">
      <HomeHero />
      <div className="shine-home-content">
        <DailyGoalsCard prepared={prepared} onPreparedChange={() => setPrepared((value) => !value)} onViewTomorrow={() => onSelectedDay('tomorrow')} />

        <div className="shine-section-title">
          <h2>{selectedDay === 'today' ? '今日课程' : '明日课程'}</h2>
          {allSlots.length > 0 && <div className="shine-course-tools">
            <span className="shine-course-date">{target.date.getMonth() + 1}月{target.date.getDate()}日 · {target.weekdayLabel}</span>
            <div className="shine-day-switch" aria-label="选择查看日期">
              <button type="button" aria-pressed={selectedDay === 'today'} onClick={() => onSelectedDay('today')}>今天</button>
              <button type="button" aria-pressed={selectedDay === 'tomorrow'} onClick={() => onSelectedDay('tomorrow')}>明天</button>
            </div>
          </div>}
        </div>
        {slots.length === 0 ? (allSlots.length > 0 ? <div className="shine-no-course"><span className="shine-no-course-art"><img src="/course-icons/no-course.png" alt="" /></span><h3>{target.label}没有课程</h3><p>可以打开课表查看和调整安排</p></div> : (
          <article className="shine-course-empty">
            <span className="shine-course-empty-icon" aria-hidden="true"><CalendarDays size={22} /></span>
            <h3>从一张课程表开始</h3>
            <p>上传图片即可自动识别，也可以逐节校对修改</p>
            <button type="button" onClick={onImport}><Camera size={17} />上传课程表</button>
            <span className="shine-course-empty-privacy"><Sparkles size={13} />图片只在你的设备上识别，不会上传保存</span>
          </article>
        )) : (
          <><ul className="shine-course-list schedule-course-list">{slots.map((slot, index) => <HomeCourseCard key={slot.id} slot={slot} iconSrc={resolveCourseIcon(slot.name)} status={mockCourseStatuses[index % mockCourseStatuses.length]} />)}</ul><p className="shine-course-caption">按上课顺序 · 共 {slots.length} 节课<span>固定作息时间 · 状态为示例</span></p></>
        )}

        <StarRewardBanner />
      </div>
    </section>
  )
}

export default function HomeApp() {
  const pageContentRef = useRef<HTMLDivElement>(null)
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
    const registerWorker = () => {
      if (import.meta.env.DEV) {
        navigator.serviceWorker?.getRegistrations().then((registrations) => Promise.all(registrations.map((registration) => registration.unregister()))).catch(() => undefined)
        window.caches?.keys().then((keys) => Promise.all(keys.map((key) => window.caches.delete(key)))).catch(() => undefined)
        return
      }
      navigator.serviceWorker?.register('/sw.js').catch(() => undefined)
    }
    const idleWindow = window as Window & { requestIdleCallback?: (callback: () => void) => number; cancelIdleCallback?: (id: number) => void }
    const idleId = idleWindow.requestIdleCallback ? idleWindow.requestIdleCallback(registerWorker) : window.setTimeout(registerWorker, 250)

    let cancelled = false
    const syncCloud = async () => {
      try {
        let token = await ensureDeviceToken()
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
    if (cloudApiConfigured) {
      syncCloud()
    } else {
      setCloudStatus('云端未连接，课程仅保存在本机')
      setPushStatus('当前预览版未配置提醒服务')
    }
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

  const showToast = (message: string) => setToast(message)
  const selectTab = (nextTab: Tab) => {
    setTab(nextTab)
    window.requestAnimationFrame(() => pageContentRef.current?.scrollTo({ top: 0 }))
  }

  const enableReminder = async () => {
    if (!cloudApiConfigured) return showToast(missingReminderServiceMessage)
    if (isIos && !isStandalone) return showToast('请先添加到主屏幕，再从桌面打开并开启提醒')
    if (!('Notification' in window)) return showToast('当前浏览器不支持通知')
    try {
      // Request permission directly from the user gesture (required by iOS Home Screen apps).
      if (await Notification.requestPermission() !== 'granted') throw new Error('需要允许通知才能提醒你')
      const config = await apiRequest<{ pushAvailable: boolean; vapidPublicKey: string }>('/api/config')
      if (!config.pushAvailable || !config.vapidPublicKey) throw new Error('后台推送密钥尚未配置，可先使用「添加到系统日历」')
      const token = await ensureDeviceToken()
      const registration = await navigator.serviceWorker.ready
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

  const installApp = async () => {
    if (installPrompt) { await installPrompt.prompt(); setInstallPrompt(null); return }
    showToast('请在浏览器菜单中选择“添加到主屏幕”')
  }

  const downloadCalendar = () => {
    const [hour, minute] = reminder.time.split(':').map(Number)
    const start = new Date(); start.setDate(start.getDate() + 1); start.setHours(hour, minute, 0, 0)
    const stamp = start.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
    const end = new Date(start.getTime() + 600000).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Shine Plan//CN', 'BEGIN:VEVENT', `UID:${uid()}@bag-plan`, `DTSTART:${stamp}`, `DTEND:${end}`, 'RRULE:FREQ=DAILY', 'SUMMARY:查看明天课程', 'DESCRIPTION:打开“闪闪计划”查看明天的课程和临时提醒。', 'BEGIN:VALARM', 'TRIGGER:-PT0M', 'ACTION:DISPLAY', 'DESCRIPTION:该查看明天的课程啦', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n')
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' })); link.download = '闪闪计划-每日课程提醒.ics'; link.click(); URL.revokeObjectURL(link.href); showToast('日历提醒已生成')
  }

  return (
    <div className={`app-shell${tab === 'home' ? ' shine-home-active' : ''}`}>
      <main className="phone-frame">
        <div className="page-content" ref={pageContentRef}>
          {!booted ? <HomeSkeleton /> : tab === 'home' ? <SmartHome allSlots={slots} selectedDay={selectedDay} onSelectedDay={setSelectedDay} onImport={() => setImportOpen(true)} /> : (
            <Suspense fallback={tab === 'schedule' ? <ScheduleSkeleton /> : <PanelSkeleton />}>
              {tab === 'schedule' && <SchedulePage slots={slots} onChange={setSlots} onImport={() => setImportOpen(true)} />}
              {tab === 'settings' && <SettingsPage reminder={reminder} onReminderChange={setReminder} onEnable={enableReminder} onDisable={disableReminder} onCalendar={downloadCalendar} onInstall={installApp} cloudStatus={cloudStatus} pushStatus={pushStatus} isIos={isIos} isStandalone={isStandalone} onReset={() => { if (!window.confirm('确定清空课程和日期提醒吗？此操作无法撤销。')) return; setSlots([]); setNotes([]); showToast('数据已清空') }} />}
            </Suspense>
          )}
        </div>
        <nav className="bottom-nav" aria-label="主导航"><NavButton active={tab === 'home'} label="首页" icon={<Home />} onClick={() => selectTab('home')} /><NavButton active={tab === 'schedule'} label="课表" icon={<CalendarDays />} onClick={() => selectTab('schedule')} /><NavButton active={tab === 'settings'} label="设置" icon={<Settings />} onClick={() => selectTab('settings')} /></nav>
      </main>
      {importOpen && <Suspense fallback={<div className="sheet-backdrop"><div className="sheet sheet-loading"><PanelSkeleton /></div></div>}><ImportSheet currentSlots={slots} onClose={() => setImportOpen(false)} onSave={(nextSlots, mode) => { setSlots(mode === 'replace' ? nextSlots : [...slots, ...nextSlots]); setImportOpen(false); selectTab('schedule'); showToast('课程表已保存') }} /></Suspense>}
      {toast && <div className="toast"><Check size={17} />{toast}</div>}
    </div>
  )
}
