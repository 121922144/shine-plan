'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, ChevronLeft, ImagePlus, ListChecks, LoaderCircle, Plus, Sparkles, X } from 'lucide-react'
import type { Slot } from '../domain'

type ImportStep = 'pick' | 'reading' | 'review'
const DAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const SCHOOL_DAYS = [1, 2, 3, 4, 5]
const PERIODS = Array.from({ length: 8 }, (_, index) => index + 1)
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

function normalizeCourseName(value: string) {
  return value
    .replace(/[|｜]/g, '')
    .replace(/^[\d\s.、-]+/, '')
    .replace(/[\s\n]+/g, '')
    .replace(/(星期|周)[一二三四五六日天]/g, '')
    .replace(/第?\d+[节课]?/g, '')
    .trim()
}

const COURSE_NAMES = [
  '道德与法治', '综合实践', '信息技术', '心理健康', '劳动技术', '体育与健康',
  '英语口语', '身心成长', '校内选修课', '基本托管',
  '语文', '数学', '英语', '物理', '化学', '生物', '地理', '历史', '政治',
  '科学', '体育', '音乐', '美术', '书法', '计算机', '阅读', '劳动', '班会', '自习', '康',
]

type OcrToken = {
  text: string
  x: number
  y: number
  x0: number
  y0: number
  x1: number
  y1: number
  confidence: number
}

function nearestKey(centers: Record<number, number>, value: number) {
  return Number(Object.entries(centers).reduce((best, current) =>
    Math.abs(current[1] - value) < Math.abs(best[1] - value) ? current : best,
  )[0])
}

function extractCourseCandidates(rawText: string, words: OcrToken[]) {
  const candidates = new Set<string>()
  for (const course of COURSE_NAMES) {
    if (rawText.includes(course)) candidates.add(course)
  }
  const fragments = [
    ...rawText.split(/[\n\r\t,，;；|｜/\\]+/),
    ...words.map((word) => word.text),
  ]
  for (const fragment of fragments) {
    const name = normalizeCourseName(fragment).replace(/[^\p{L}\p{N}]/gu, '')
    if (
      name.length >= 2 && name.length <= 18 &&
      !/课程|课表|节次|时间|午休|早读|班级|姓名|上午|下午|教师|教室|星期|周次/.test(name) &&
      !/^\d+$/.test(name)
    ) candidates.add(name)
  }
  return Array.from(candidates).slice(0, 40)
}

function groupLinePositions(positions: number[]) {
  const groups: number[][] = []
  for (const position of positions) {
    const current = groups.at(-1)
    if (!current || position > current.at(-1)! + 1) groups.push([position])
    else current.push(position)
  }
  return groups.map((group) => Math.round(group.reduce((sum, value) => sum + value, 0) / group.length))
}

function findEvenlySpacedBounds(lines: number[], count: number, width: number) {
  let best: { lines: number[]; score: number } | null = null
  for (let index = 0; index <= lines.length - count; index += 1) {
    const candidate = lines.slice(index, index + count)
    const gaps = candidate.slice(1).map((value, gapIndex) => value - candidate[gapIndex])
    const mean = gaps.reduce((sum, value) => sum + value, 0) / gaps.length
    if (mean < width * 0.08 || candidate.at(-1)! - candidate[0] < width * 0.6) continue
    const score = gaps.reduce((sum, value) => sum + Math.abs(value - mean), 0) / gaps.length / mean
    if (!best || score < best.score) best = { lines: candidate, score }
  }
  return best && best.score < 0.22 ? best.lines : null
}

function editDistance(left: string, right: string) {
  const row = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    let diagonal = row[0]
    row[0] = leftIndex
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const previous = row[rightIndex]
      row[rightIndex] = Math.min(
        row[rightIndex] + 1,
        row[rightIndex - 1] + 1,
        diagonal + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      )
      diagonal = previous
    }
  }
  return row[right.length]
}

function matchCourseName(value: string) {
  const clean = normalizeCourseName(value).replace(/[^\p{L}\p{N}]/gu, '')
  if (!clean || /午休|大课间|自由阅读|教师|老师|陈涛|杨宏业/.test(clean)) return ''
  const exact = COURSE_NAMES.find((course) => clean.includes(course))
  if (exact) return exact
  if (clean.length === 1) {
    const suffixMatches = COURSE_NAMES.filter((course) => course.endsWith(clean))
    if (suffixMatches.length === 1) return suffixMatches[0]
    return ''
  }
  const ranked = COURSE_NAMES
    .filter((course) => Math.abs(course.length - clean.length) <= 1)
    .map((course) => ({ course, distance: editDistance(clean, course) }))
    .sort((left, right) => left.distance - right.distance)
  const closest = ranked[0]
  const allowedDistance = clean.length <= 4 ? 1 : Math.max(1, Math.floor(clean.length * 0.28))
  return closest && closest.distance <= allowedDistance ? closest.course : ''
}

async function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('无法生成识别图片')), 'image/png')
  })
}

async function createEnhancedCell(
  source: HTMLCanvasElement,
  left: number,
  top: number,
  right: number,
  bottom: number,
  threshold?: number,
) {
  const width = Math.max(1, right - left)
  const height = Math.max(1, bottom - top)
  const sourceContext = source.getContext('2d', { willReadFrequently: true })!
  const image = sourceContext.getImageData(left, top, width, height)
  const luminances: number[] = []
  for (let index = 0; index < image.data.length; index += 4) {
    const value = Math.round(image.data[index] * 0.299 + image.data[index + 1] * 0.587 + image.data[index + 2] * 0.114)
    luminances.push(value)
  }
  const sorted = [...luminances].sort((a, b) => a - b)
  const low = sorted[Math.floor(sorted.length * 0.02)] ?? 0
  const high = sorted[Math.floor(sorted.length * 0.88)] ?? 255
  const range = Math.max(22, high - low)
  for (let pixel = 0; pixel < luminances.length; pixel += 1) {
    const normalizedValue = Math.max(0, Math.min(255, Math.round(((luminances[pixel] - low) / range) * 255)))
    const value = threshold === undefined ? normalizedValue : normalizedValue < threshold ? 0 : 255
    const offset = pixel * 4
    image.data[offset] = value
    image.data[offset + 1] = value
    image.data[offset + 2] = value
    image.data[offset + 3] = 255
  }
  const normalized = document.createElement('canvas')
  normalized.width = width
  normalized.height = height
  normalized.getContext('2d')!.putImageData(image, 0, 0)
  const enlarged = document.createElement('canvas')
  enlarged.width = Math.max(700, width * 5)
  enlarged.height = Math.max(80, Math.round(height * enlarged.width / width))
  const enlargedContext = enlarged.getContext('2d')!
  enlargedContext.imageSmoothingEnabled = true
  enlargedContext.imageSmoothingQuality = 'high'
  enlargedContext.fillStyle = 'white'
  enlargedContext.fillRect(0, 0, enlarged.width, enlarged.height)
  enlargedContext.drawImage(normalized, 0, 0, enlarged.width, enlarged.height)
  return canvasToBlob(enlarged)
}

async function recognizeGridTimetable(
  file: File,
  worker: any,
  onProgress: (progress: number, status: string) => void,
): Promise<{ slots: Slot[]; candidates: string[]; rawText: string } | null> {
  const bitmap = await createImageBitmap(file)
  const source = document.createElement('canvas')
  source.width = bitmap.width
  source.height = bitmap.height
  const context = source.getContext('2d', { willReadFrequently: true })!
  context.drawImage(bitmap, 0, 0)
  bitmap.close()
  const image = context.getImageData(0, 0, source.width, source.height)
  const dark = (x: number, y: number) => {
    const offset = (y * source.width + x) * 4
    return image.data[offset] < 72 && image.data[offset + 1] < 72 && image.data[offset + 2] < 72
  }

  const verticalPixels: number[] = []
  for (let x = 0; x < source.width; x += 1) {
    let count = 0
    for (let y = Math.floor(source.height * 0.12); y < source.height; y += 1) if (dark(x, y)) count += 1
    if (count > source.height * 0.27) verticalPixels.push(x)
  }
  const verticalLines = groupLinePositions(verticalPixels)
  const dayBounds = findEvenlySpacedBounds(verticalLines, 6, source.width)
  if (!dayBounds) return null

  const majorHorizontalPixels: number[] = []
  const minorHorizontalPixels: number[] = []
  for (let y = 0; y < source.height; y += 1) {
    let count = 0
    for (let x = 0; x < source.width; x += 1) if (dark(x, y)) count += 1
    if (count > source.width * 0.52) majorHorizontalPixels.push(y)
    if (count > source.width * 0.15) minorHorizontalPixels.push(y)
  }
  const majorLines = groupLinePositions(majorHorizontalPixels)
  const minorLines = groupLinePositions(minorHorizontalPixels)
  if (majorLines.length < 5) return null
  const headerBottom = majorLines[1]
  const lastMinor = minorLines.at(-1)
  if (lastMinor && lastMinor > majorLines.at(-1)! + source.height * 0.06) majorLines.push(lastMinor)

  const fillRatio = (top: number, bottom: number) => {
    let filled = 0
    let total = 0
    for (let y = top + 3; y < bottom - 3; y += 2) {
      for (let x = dayBounds[0] + 3; x < dayBounds[5] - 3; x += 2) {
        const offset = (y * source.width + x) * 4
        const red = image.data[offset]
        const green = image.data[offset + 1]
        const blue = image.data[offset + 2]
        const maximum = Math.max(red, green, blue)
        const minimum = Math.min(red, green, blue)
        if (maximum - minimum > 20 || maximum < 220) filled += 1
        total += 1
      }
    }
    return total ? filled / total : 0
  }

  const periodRows = majorLines.slice(1, -1)
    .map((top, index) => ({ top, bottom: majorLines[index + 2] }))
    .filter((row) => row.top >= headerBottom && row.bottom - row.top >= 20 && fillRatio(row.top, row.bottom) > 0.15)
    .slice(0, 8)
  if (periodRows.length < 3) return null

  const slots: Slot[] = []
  const rawLines: string[] = []
  const totalCells = periodRows.length * 5
  let completed = 0
  for (let rowIndex = 0; rowIndex < periodRows.length; rowIndex += 1) {
    const row = periodRows[rowIndex]
    const rowHeight = row.bottom - row.top
    const textHeight = rowHeight < 40 ? rowHeight - 6 : Math.floor(rowHeight * 0.58)
    for (let column = 0; column < 5; column += 1) {
      const blob = await createEnhancedCell(
        source,
        dayBounds[column] + 3,
        row.top + 3,
        dayBounds[column + 1] - 3,
        Math.min(row.bottom - 3, row.top + 3 + textHeight),
      )
      const result = await worker.recognize(blob, {}, { text: true })
      let raw = String(result.data?.text ?? '').replace(/\s+/g, '')
      let course = matchCourseName(raw)
      if (!course) {
        const retryBlob = await createEnhancedCell(
          source,
          dayBounds[column] + 3,
          row.top + 3,
          dayBounds[column + 1] - 3,
          Math.min(row.bottom - 3, row.top + 3 + textHeight),
          140,
        )
        const retryResult = await worker.recognize(retryBlob, {}, { text: true })
        const retryRaw = String(retryResult.data?.text ?? '').replace(/\s+/g, '')
        course = matchCourseName(retryRaw)
        raw = [raw, retryRaw].filter(Boolean).join(' / ')
      }
      if (course) {
        slots.push({ id: uid(), day: column + 1, period: rowIndex + 1, name: course })
        rawLines.push(`${DAY_NAMES[column + 1]} 第${rowIndex + 1}节：${raw} → ${course}`)
      } else if (raw) rawLines.push(`${DAY_NAMES[column + 1]} 第${rowIndex + 1}节：${raw}（未采用）`)
      completed += 1
      onProgress(12 + Math.round((completed / totalCells) * 82), `正在逐格读取课程（${completed}/${totalCells}）…`)
    }
  }
  return {
    slots,
    candidates: Array.from(new Set(slots.map((slot) => slot.name))),
    rawText: rawLines.join('\n'),
  }
}

function inferSlotsFromOcr(data: any): { slots: Slot[]; candidates: string[]; rawText: string } {
  const rawText = String(data?.text ?? '').trim()
  const words: OcrToken[] = []
  const blocks = Array.isArray(data?.blocks) ? data.blocks : []
  for (const block of blocks) {
    for (const paragraph of block.paragraphs ?? []) {
      for (const line of paragraph.lines ?? []) {
        for (const word of line.words ?? []) {
          const box = word.bbox ?? {}
          const x0 = Number(box.x0 ?? 0)
          const y0 = Number(box.y0 ?? 0)
          const x1 = Number(box.x1 ?? x0)
          const y1 = Number(box.y1 ?? y0)
          words.push({
            text: String(word.text ?? '').trim(),
            x: (x0 + x1) / 2,
            y: (y0 + y1) / 2,
            x0,
            y0,
            x1,
            y1,
            confidence: Number(word.confidence ?? 0),
          })
        }
      }
    }
  }

  const candidates = extractCourseCandidates(rawText, words)
  if (!words.length) return { slots: [], candidates, rawText }

  const pageLeft = Math.min(...words.map((word) => word.x0))
  const pageRight = Math.max(...words.map((word) => word.x1))
  const pageTop = Math.min(...words.map((word) => word.y0))
  const pageBottom = Math.max(...words.map((word) => word.y1))
  const pageWidth = Math.max(1, pageRight - pageLeft)
  const pageHeight = Math.max(1, pageBottom - pageTop)
  const chineseDay: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 0, 天: 0 }
  const englishDay: Record<string, number> = { mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 0 }
  const headers = words.map((word) => {
    const compact = word.text.replace(/\s/g, '').toLowerCase()
    const chineseMatch = compact.match(/(?:星期|礼拜|周)([一二三四五六日天])/)
    const englishMatch = compact.match(/^(mon|tue|wed|thu|fri|sat|sun)/)
    const day = chineseMatch ? chineseDay[chineseMatch[1]] : englishMatch ? englishDay[englishMatch[1]] : undefined
    return day === undefined ? null : { ...word, day }
  }).filter(Boolean) as Array<OcrToken & { day: number }>

  // Some OCR engines split “星期一” into “星期” and “一”. A horizontal row containing
  // at least three weekday characters is therefore also treated as the header row.
  const singleDayTokens = words.filter((word) => /^[一二三四五六日天]$/.test(word.text))
  for (const seed of singleDayTokens) {
    const row = singleDayTokens.filter((word) => Math.abs(word.y - seed.y) <= Math.max(14, pageHeight * 0.025))
    const uniqueDays = new Set(row.map((word) => chineseDay[word.text]))
    if (uniqueDays.size < 3) continue
    for (const word of row) headers.push({ ...word, day: chineseDay[word.text] })
    break
  }

  const uniqueHeaders = Array.from(new Map(headers.map((header) => [header.day, header])).values())
    .filter((header) => header.day >= 1 && header.day <= 5)
  const dayCenters: Record<number, number> = {}
  if (uniqueHeaders.length >= 2) {
    const meanDay = uniqueHeaders.reduce((sum, header) => sum + header.day, 0) / uniqueHeaders.length
    const meanX = uniqueHeaders.reduce((sum, header) => sum + header.x, 0) / uniqueHeaders.length
    const numerator = uniqueHeaders.reduce((sum, header) => sum + (header.day - meanDay) * (header.x - meanX), 0)
    const denominator = uniqueHeaders.reduce((sum, header) => sum + (header.day - meanDay) ** 2, 0) || 1
    const step = numerator / denominator
    for (const day of SCHOOL_DAYS) dayCenters[day] = meanX + (day - meanDay) * step
  } else {
    // Most school timetables use one narrow period column plus five weekday columns.
    for (const day of SCHOOL_DAYS) dayCenters[day] = pageLeft + pageWidth * ((day + 0.5) / 6)
  }

  const headerBottom = uniqueHeaders.length
    ? Math.max(...uniqueHeaders.map((header) => header.y1))
    : pageTop + pageHeight * 0.105
  const firstDayX = dayCenters[1]
  const dayStep = Math.abs(dayCenters[2] - dayCenters[1]) || pageWidth / 6
  const rawPeriodMarks = words
    .map((word) => {
      const match = word.text.replace(/\s/g, '').match(/^(?:第)?([1-8])(?:节|课)?$/)
      return match ? { ...word, period: Number(match[1]) } : null
    })
    .filter(Boolean) as Array<OcrToken & { period: number }>
  const periodMarks = rawPeriodMarks.filter((word) => word.x < firstDayX - dayStep * 0.35 && word.y > headerBottom)
  const periodCenters: Record<number, number> = {}
  if (periodMarks.length >= 2) {
    const meanPeriod = periodMarks.reduce((sum, mark) => sum + mark.period, 0) / periodMarks.length
    const meanY = periodMarks.reduce((sum, mark) => sum + mark.y, 0) / periodMarks.length
    const numerator = periodMarks.reduce((sum, mark) => sum + (mark.period - meanPeriod) * (mark.y - meanY), 0)
    const denominator = periodMarks.reduce((sum, mark) => sum + (mark.period - meanPeriod) ** 2, 0) || 1
    const step = numerator / denominator
    for (const period of PERIODS) periodCenters[period] = meanY + (period - meanPeriod) * step
  } else {
    const contentHeight = Math.max(1, pageBottom - headerBottom)
    for (const period of PERIODS) periodCenters[period] = headerBottom + contentHeight * ((period - 0.5) / 8)
  }

  const noisePattern = /课程|课表|节次|时间|午休|早读|班级|姓名|上午|下午|教师|教室|星期|礼拜|周次/
  const content = words.filter((word) => {
    const name = normalizeCourseName(word.text).replace(/[^\p{L}\p{N}]/gu, '')
    return (
      word.y > headerBottom &&
      word.x > firstDayX - dayStep * 0.55 &&
      name.length >= 1 &&
      word.confidence >= 15 &&
      !noisePattern.test(name) &&
      !/^(?:第)?\d+(?:节|课)?$/.test(name) &&
      !/^[-—_=+]+$/.test(name)
    )
  })

  const grouped = new Map<string, OcrToken[]>()
  for (const word of content) {
    const day = nearestKey(dayCenters, word.x)
    const period = nearestKey(periodCenters, word.y)
    const key = `${day}-${period}`
    grouped.set(key, [...(grouped.get(key) ?? []), word])
  }

  const slots = Array.from(grouped.entries()).map(([key, cellWords]) => {
    const [day, period] = key.split('-').map(Number)
    const combined = normalizeCourseName(
      Array.from(new Set(cellWords.sort((a, b) => a.x - b.x).map((word) => word.text))).join(''),
    ).replace(/[^\p{L}\p{N}]/gu, '')
    const knownCourse = COURSE_NAMES.find((course) => combined.includes(course))
    const name = knownCourse ?? combined.replace(/(?:老师|教师|教室|校区).*$/, '').slice(0, 18)
    return { id: uid(), day, period, name }
  }).filter((slot) => slot.name.length >= 2 && !noisePattern.test(slot.name))

  return {
    slots,
    candidates: Array.from(new Set([...slots.map((slot) => slot.name), ...candidates])).slice(0, 40),
    rawText,
  }
}

export function ImportSheet({ currentSlots, onClose, onSave }: { currentSlots: Slot[]; onClose: () => void; onSave: (slots: Slot[], mode: 'replace' | 'append') => void }) {
  const [step, setStep] = useState<ImportStep>('pick')
  const [preview, setPreview] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('正在准备识别…')
  const [draft, setDraft] = useState<Slot[]>([])
  const [candidates, setCandidates] = useState<string[]>([])
  const [ocrText, setOcrText] = useState('')
  const [day, setDay] = useState(1)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])
  const chooseFile = (selected?: File) => {
    if (!selected) return
    if (preview) URL.revokeObjectURL(preview)
    setFile(selected)
    setPreview(URL.createObjectURL(selected))
    setError('')
  }
  const updateDraft = (period: number, name: string) => {
    const existing = draft.find((slot) => slot.day === day && slot.period === period)
    if (existing) setDraft(name.trim() ? draft.map((slot) => slot.id === existing.id ? { ...slot, name } : slot) : draft.filter((slot) => slot.id !== existing.id))
    else if (name.trim()) setDraft([...draft, { id: uid(), day, period, name }])
  }
  const recognize = async () => {
    if (!file) return
    setStep('reading')
    setError('')
    let worker: any = null
    let cellRecognition = false
    try {
      const { createWorker, OEM, PSM } = await import('tesseract.js')
      worker = await createWorker('chi_sim', OEM.LSTM_ONLY, {
        logger: (message: any) => {
          if (!cellRecognition && typeof message.progress === 'number') setProgress(Math.round(message.progress * 100))
          if (!cellRecognition && message.status === 'recognizing text') setStatus('正在读取课程名称…')
          else if (message.status === 'loading language traineddata') setStatus('首次使用，正在加载中文识别包…')
        },
      })
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SINGLE_LINE,
        user_defined_dpi: '300',
      })
      cellRecognition = true
      const gridResult = await recognizeGridTimetable(file, worker, (nextProgress, nextStatus) => {
        setProgress(nextProgress)
        setStatus(nextStatus)
      })
      let inferred: { slots: Slot[]; candidates: string[]; rawText: string }
      if (gridResult && gridResult.slots.length >= 8) {
        inferred = gridResult
      } else {
        cellRecognition = false
        setProgress(0)
        setStatus('正在读取整张课程表…')
        await worker.setParameters({
          tessedit_pageseg_mode: PSM.SPARSE_TEXT,
          preserve_interword_spaces: '1',
          user_defined_dpi: '300',
        })
        const result = await worker.recognize(file, { rotateAuto: true }, { blocks: true, text: true })
        inferred = inferSlotsFromOcr(result.data)
      }
      setDraft(inferred.slots)
      setCandidates(inferred.candidates)
      setOcrText(inferred.rawText)
      setStep('review')
    } catch (reason) {
      console.error(reason)
      setStep('pick')
      setError('识别没有成功。你可以换一张更清晰、拍正的图片重试，或直接填写课程。')
    } finally {
      if (worker) await worker.terminate().catch(() => undefined)
    }
  }
  const useDemo = () => {
    const sample: Array<[number, number, string]> = [
      [1, 1, '语文'], [1, 2, '数学'], [1, 3, '英语'], [1, 5, '美术'],
      [2, 1, '数学'], [2, 2, '语文'], [2, 4, '体育'], [2, 6, '科学'],
      [3, 1, '英语'], [3, 2, '数学'], [3, 3, '语文'], [3, 5, '音乐'],
      [4, 1, '语文'], [4, 2, '科学'], [4, 4, '英语'], [4, 6, '体育'],
      [5, 1, '数学'], [5, 2, '语文'], [5, 3, '英语'], [5, 5, '班会'],
    ]
    setDraft(sample.map(([itemDay, period, name]) => ({ id: uid(), day: itemDay, period, name })))
    setCandidates(['语文', '数学', '英语', '科学', '体育', '音乐', '美术', '班会'])
    setOcrText('语文 数学 英语 科学 体育 音乐 美术 班会（示例数据）')
    setStep('review')
  }

  return (
    <div className="sheet-backdrop" role="dialog" aria-modal="true">
      <div className="sheet import-sheet">
        <div className="sheet-handle" />
        <div className="sheet-header">
          {step !== 'pick' ? <button className="icon-button" onClick={() => setStep('pick')}><ChevronLeft size={21} /></button> : <div />}
          <div><p className="eyebrow">IMPORT</p><h2>{step === 'review' ? '校对课程表' : '上传课程表'}</h2></div>
          <button className="icon-button" onClick={onClose}><X size={21} /></button>
        </div>
        {step === 'pick' && (
          <div className="sheet-body">
            <button className={preview ? 'upload-zone has-image' : 'upload-zone'} onClick={() => inputRef.current?.click()}>
              {preview ? <img src={preview} alt="课程表预览" /> : <><span><ImagePlus size={29} /></span><h3>选择课程表图片</h3><p>建议使用正面截图或清晰照片</p></>}
            </button>
            <input ref={inputRef} className="visually-hidden" type="file" accept="image/*" onChange={(event) => chooseFile(event.target.files?.[0])} />
            {error && <p className="error-message">{error}</p>}
            <div className="tip-list"><p><Check size={16} />尽量裁掉课程表外的其他内容</p><p><Check size={16} />光线均匀，文字越清楚越好</p><p><Check size={16} />识别后还可以逐项修改</p></div>
            <button className="primary-button wide" disabled={!file} onClick={recognize}><Sparkles size={18} />开始识别</button>
            <button className="text-button" onClick={useDemo}>暂时没有图片？试用示例课程表</button>
          </div>
        )}
        {step === 'reading' && (
          <div className="reading-state"><div className="scan-preview">{preview && <img src={preview} alt="正在识别的课程表" />}<span /></div><LoaderCircle className="spin" size={27} /><h3>{status}</h3><p>整个过程通常需要 10～30 秒</p><div className="progress"><span style={{ width: `${Math.max(6, progress)}%` }} /></div><strong>{progress}%</strong></div>
        )}
        {step === 'review' && (
          <div className="sheet-body review-body">
            <div className={draft.length ? 'review-note' : 'review-note needs-help'}>
              <ListChecks size={18} />
              <p>
                <strong>{draft.length ? `已自动排入 ${draft.length} 节课` : candidates.length ? '识别到课程名，但无法确定位置' : '图片文字不够清晰'}</strong><br />
                {draft.length ? '请按星期检查，空白或错误的课程可以直接修改。' : candidates.length ? '选择星期，再点下方课程名，或直接填写对应节次。' : '可以返回重拍，或者在下方直接填写课程。'}
              </p>
            </div>
            <div className="day-tabs compact">{SCHOOL_DAYS.map((item) => <button key={item} className={day === item ? 'active' : ''} onClick={() => setDay(item)}><span>{DAY_NAMES[item].slice(1)}</span></button>)}</div>
            <div className="period-list compact-list">{PERIODS.map((period) => {
              const slot = draft.find((item) => item.day === day && item.period === period)
              return <label className="period-row" key={`${day}-${period}`}><span>{period}</span><input value={slot?.name ?? ''} onChange={(event) => updateDraft(period, event.target.value)} placeholder="无课程" /></label>
            })}</div>
            {candidates.length > 0 && <div className="candidate-box"><p>识别到的课程 · 点击添加到{DAY_NAMES[day]}</p><div>{candidates.slice(0, 20).map((name) => <button key={name} onClick={() => { const empty = PERIODS.find((period) => !draft.some((slot) => slot.day === day && slot.period === period)); if (empty) updateDraft(empty, name) }}>{name}<Plus size={13} /></button>)}</div></div>}
            <details className="ocr-details">
              <summary>查看识别原文（{ocrText.length} 个字）</summary>
              <pre>{ocrText || '没有读取到文字。请换一张更清晰、正面拍摄的图片重试。'}</pre>
            </details>
            <button className="primary-button wide" disabled={!draft.length} onClick={() => onSave(draft, currentSlots.length ? 'replace' : 'append')}>保存课程表</button>
          </div>
        )}
      </div>
    </div>
  )
}

