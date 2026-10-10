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
  '道德与法治', '综合实践', '综合实践与劳动', '信息技术', '心理健康', '劳动技术', '体育与健康',
  '英语口语', '身心成长', '校内选修课', '基本托管', '基本托管A', '延时服务', '素质拓展',
  '语文', '数学', '英语', '物理', '化学', '生物', '地理', '历史', '政治',
  '科学', '体育', '音乐', '美术', '书法', '计算机', '阅读', '劳动', '班会', '自习', '康',
]

// 跨列横条（眼保健操/大课间/午休…）的文字会被 OCR 拆碎并混入邻近格，按字符集合整体剥离
const NOISE_STRIP_NAMES = ['眼保健操', '大课间', '自由阅读', '自主学习', '午餐午休', '午休', '早读', '自律']
function stripNoiseChars(value: string) {
  let result = value
  for (const noise of NOISE_STRIP_NAMES) {
    const pool = [...noise]
    let output = ''
    for (const char of result) {
      const index = pool.indexOf(char)
      if (index >= 0) pool.splice(index, 1)
      else output += char
    }
    if (pool.length === 0) result = output
  }
  return result
}

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

function findEvenlySpacedBounds(lines: number[], count: number, width: number, maxScore = 0.22) {
  let best: { lines: number[]; score: number } | null = null
  for (let startIndex = 0; startIndex < lines.length; startIndex += 1) {
    for (let endIndex = startIndex + count - 1; endIndex < lines.length; endIndex += 1) {
      const start = lines[startIndex]
      const end = lines[endIndex]
      const span = end - start
      const step = span / (count - 1)
      if (step < width * 0.08 || span < width * 0.6) continue
      const candidate = [start]
      let previousIndex = startIndex
      let valid = true
      for (let position = 1; position < count - 1; position += 1) {
        const expected = start + step * position
        const lastAllowed = endIndex - (count - 1 - position)
        let selectedIndex = -1
        let selectedDistance = Number.POSITIVE_INFINITY
        for (let index = previousIndex + 1; index <= lastAllowed; index += 1) {
          const distance = Math.abs(lines[index] - expected)
          if (distance < selectedDistance) {
            selectedIndex = index
            selectedDistance = distance
          }
        }
        if (selectedIndex < 0) {
          valid = false
          break
        }
        candidate.push(lines[selectedIndex])
        previousIndex = selectedIndex
      }
      if (!valid) continue
      candidate.push(end)
      const score = candidate.reduce((sum, value, index) => (
        sum + Math.abs(value - (start + step * index)) / step
      ), 0) / count
      // 有“节次”列的课表会出现 7 条等距竖线（节次列 + 周一至周五）。
      // 同样精确的 6 条线必须选靠右的一组，否则周一会被误当成节次列，
      // 导致周一全空、周二读成周一。
      if (!best || score < best.score - 0.001 ||
          (Math.abs(score - best.score) <= 0.001 && end > best.lines.at(-1)!)) {
        best = { lines: candidate, score }
      }
    }
  }
  return best && best.score < maxScore ? best.lines : null
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
  const clean = stripNoiseChars(normalizeCourseName(value).replace(/[^\p{L}\p{N}]/gu, ''))
  if (!clean || /午休|大课间|自由阅读|眼保健操|教师|老师|陈涛|杨宏业/.test(clean)) return ''
  // 课程表中“康”是一个完整的课程名，不能因为它是单字而被当作 OCR 噪声丢弃。
  if (clean === '康') return '康'
  // 字符集乱序整词匹配：OCR 会打乱同一格的字符顺序（如「时延服务」「与综合劳动实践」），
  // 整词同字符集比子串匹配更可靠，优先处理
  const sortedClean = [...clean].sort().join('')
  const charsetMatch = COURSE_NAMES
    .filter((course) => course.length >= 2 && course.length === clean.length && [...course].sort().join('') === sortedClean)
  if (charsetMatch.length) return charsetMatch[0]
  // 优先最长子串，并排除单字课程名（避免「班使健康」被错误匹配成「康」而导致整格被丢弃）
  const exact = COURSE_NAMES
    .filter((course) => course.length >= 2)
    .sort((a, b) => b.length - a.length)
    .find((course) => clean.includes(course))
  if (exact) return exact
  if (clean.length === 1) {
    const characterMatches = COURSE_NAMES.filter((course) => course.length >= 2 && (course.startsWith(clean) || course.endsWith(clean)))
    if (characterMatches.length === 1) return characterMatches[0]
    return ''
  }
  const ranked = COURSE_NAMES
    .filter((course) => course.length >= 2 && Math.abs(course.length - clean.length) <= 1)
    .map((course) => ({ course, distance: editDistance(clean, course) }))
    .sort((left, right) => left.distance - right.distance)
  const closest = ranked[0]
  const allowedDistance = Math.max(1, Math.floor(clean.length * 0.28))
  // 残缺的两个字不能随意替换两个字；多个课程同样接近时也不猜第一个。
  return closest && closest.distance <= allowedDistance && closest.distance < (ranked[1]?.distance ?? Infinity)
    ? closest.course : ''
}

function courseEvidence(raw: string, course: string) {
  if (!course) return 0
  const clean = normalizeCourseName(raw).replace(/[^\p{L}\p{N}]/gu, '')
  const names = course.split(' / ').map((name) => name.replace(/[^\p{L}\p{N}]/gu, ''))
  // 完整文字优先于模糊补字，避免先读到的错字压住后续正确结果。
  if (names.every((name) => clean.includes(name))) return 3
  if (names.length === 1 && [...clean].sort().join('') === [...names[0]].sort().join('')) return 3
  if (COURSE_NAMES.some((name) => name.length >= 2 && clean.includes(name) && course.includes(name))) return 2
  return 1
}

function preferCourse(raw: string, candidate: string, current: { name: string; evidence: number }) {
  const evidence = courseEvidence(raw, candidate)
  return evidence > current.evidence || (evidence === current.evidence && candidate.length > current.name.length)
    ? { name: candidate, evidence } : current
}

function matchGridCourse(value: string) {
  const compact = normalizeCourseName(value).replace(/\s+/g, '')
  if (/^康(?:陈[\p{L}]{1,3})?$/u.test(compact)) return '康'
  // 课程名称被单元格边界截断时，OCR 可能只读出“道德与”。
  // 这是课程表中“道德与法治”的独有前缀；不能要求完整四字都出现。
  // 排除跨课程的额外文字，避免将普通噪声错误补全。
  if (/^道德与(?:法治)?[|｜;；:：、，,.。!！]?$/u.test(compact)) return '道德与法治'
  if (compact.includes('班会') && compact.includes('心理健康')) {
    // OCR 已识别出连接词时保留课表原文，不统一替换成“·”。
    const hasOriginalAnd = /班会与心理健康/.test(compact)
    const hasOriginalDot = /班会[·•・]心理健康/.test(compact)
    const course = hasOriginalAnd ? '班会与心理健康'
      : hasOriginalDot ? '班会 · 心理健康'
        : '班会与心理健康'
    return compact.includes('升旗') ? `${course}（含升旗仪式）` : course
  }
  // 第 7 节有时会在同一个时间段里并列展示两种安排，不能只返回前半个课程名。
  const hasDelayService = compact.includes('延时服务') || compact.includes('服务延')
  const hasQualityExtension = compact.includes('素质拓展') || compact.includes('拓展素质')
  if (hasDelayService && hasQualityExtension) {
    return '延时服务 / 素质拓展'
  }
  if (/基本特色托管选修A|基本托管A.*特色选修|特色选修.*基本托管A/.test(compact)) {
    return '基本托管A（特色选修）'
  }
  // 周二第 6 节是带说明的长课程名。优先保留完整标题，避免被截断成“校内选修课”。
  if (/基本托管(?:A)?[：:]?校内选修课/.test(compact) || /校内选修课.*基本托管/.test(compact)) {
    return '基本托管A：校内选修课'
  }
  if (/基本托管A/.test(compact)) return '基本托管A'
  return matchCourseName(compact)
}

async function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('无法生成识别图片')), 'image/png')
  })
}

async function createOriginalCell(source: HTMLCanvasElement, left: number, top: number, right: number, bottom: number, scale = 1) {
  // 去掉上下空白及残留竖线。长边线会使 OCR 把窄格里的整行文字当作图形忽略。
  const width = right - left
  const height = bottom - top
  const pixels = source.getContext('2d')!.getImageData(left, top, width, height).data
  const textRows: number[] = []
  for (let y = 0; y < height; y += 1) {
    let ink = 0
    for (let x = 2; x < width - 2; x += 1) {
      const offset = (y * width + x) * 4
      if (Math.max(pixels[offset], pixels[offset + 1], pixels[offset + 2]) < 160) ink += 1
    }
    if (ink > Math.max(2, width * 0.04)) textRows.push(y)
  }
  if (textRows.length) {
    bottom = Math.min(bottom, top + textRows.at(-1)! + 3)
    top += Math.max(0, textRows[0] - 2)
  }
  const canvas = document.createElement('canvas')
  const padding = 12
  canvas.width = (right - left) * scale + padding * 2
  canvas.height = (bottom - top) * scale + padding * 2
  const context = canvas.getContext('2d')!
  context.fillStyle = 'white'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(source, left, top, right - left, bottom - top,
    padding, padding, (right - left) * scale, (bottom - top) * scale)
  return canvasToBlob(canvas)
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
  const contentWidth = Math.max(700, width * 5)
  const contentHeight = Math.max(80, Math.round(height * contentWidth / width))
  const padding = 32
  enlarged.width = contentWidth + padding * 2
  enlarged.height = contentHeight + padding * 2
  const enlargedContext = enlarged.getContext('2d')!
  enlargedContext.imageSmoothingEnabled = true
  enlargedContext.imageSmoothingQuality = 'high'
  enlargedContext.fillStyle = 'white'
  enlargedContext.fillRect(0, 0, enlarged.width, enlarged.height)
  enlargedContext.drawImage(normalized, padding, padding, contentWidth, contentHeight)
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
    // 手机截图/压缩图中的表格线经常是抗锯齿灰线，过低阈值会让整张表无法找到网格。
    return image.data[offset] < 120 && image.data[offset + 1] < 120 && image.data[offset + 2] < 120
  }

  const longestDarkRun = (length: number, isDark: (position: number) => boolean) => {
    let best = 0
    let run = 0
    let gap = 0
    for (let position = 0; position < length; position += 1) {
      if (isDark(position)) {
        run += gap + 1
        gap = 0
      } else if (run > 0 && gap < 1) {
        gap += 1
      } else {
        best = Math.max(best, run)
        run = 0
        gap = 0
      }
    }
    return Math.max(best, run)
  }

  const verticalPixels: number[] = []
  for (let x = 0; x < source.width; x += 1) {
    const startY = Math.floor(source.height * 0.1)
    const run = longestDarkRun(source.height - startY, (offset) => dark(x, startY + offset))
    if (run > source.height * 0.045) verticalPixels.push(x)
  }
  const verticalLines = groupLinePositions(verticalPixels)
  // 第 7 节会在每个星期格内再分成两格，因此必须允许跳过这些“半列”竖线，
  // 从候选线中挑出六条真正的星期边界。
  // 部分课表把“节次”列与五个星期列画成完全等宽的 6 列。
  // 此时会检测到 7 条等距竖线；必须排除最左侧的节次列，
  // 取最右边的 6 条边界。仅凭“等距评分”无法区分这两组。
  const isEvenlySpaced = (bounds: number[]) => {
    if (bounds.length !== 7) return false
    const gaps = bounds.slice(1).map((line, index) => line - bounds[index])
    const average = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length
    return average >= source.width * 0.075 &&
      average <= source.width * 0.23 &&
      gaps.every((gap) => Math.abs(gap - average) <= average * 0.14)
  }
  const dayBounds = isEvenlySpaced(verticalLines)
    ? verticalLines.slice(1)
    : findEvenlySpacedBounds(verticalLines, 6, source.width, 0.16)
  if (!dayBounds) return null
  // 网格日志确认：旧算法可能选到 [119,251,365,498,630,762]，
  // 但真实最右边界为 845。以真实右边界为锚点重新定位五个星期，
  // 不再用未锚定的等距搜索重复选回错误的六条线。
  const rightmostTableLine = verticalLines.at(-1)
  if (rightmostTableLine !== undefined &&
      rightmostTableLine > source.width * 0.75 &&
      rightmostTableLine - dayBounds[5] > source.width * 0.07) {
    let bestRightAnchored: { bounds: number[]; score: number } | null = null
    for (const left of verticalLines) {
      const span = rightmostTableLine - left
      const step = span / 5
      if (step < source.width * 0.085 || step > source.width * 0.19) continue
      const bounds = [left]
      let previous = left
      let score = 0
      for (let index = 1; index < 5; index += 1) {
        const expected = left + index * step
        const candidates = verticalLines.filter((x) => x > previous + step * 0.55 && x < rightmostTableLine)
        const nearest = candidates.sort((a, b) => Math.abs(a - expected) - Math.abs(b - expected))[0]
        if (nearest === undefined) break
        bounds.push(nearest)
        score += Math.abs(nearest - expected) / step
        previous = nearest
      }
      if (bounds.length !== 5) continue
      bounds.push(rightmostTableLine)
      score /= 6
      if (!bestRightAnchored || score < bestRightAnchored.score) bestRightAnchored = { bounds, score }
    }
    if (bestRightAnchored && bestRightAnchored.score < 0.2) {
      dayBounds.splice(0, dayBounds.length, ...bestRightAnchored.bounds)
    }
  }

  const majorHorizontalPixels: number[] = []
  const minorHorizontalPixels: number[] = []
  for (let y = 0; y < source.height; y += 1) {
    const run = longestDarkRun(source.width, (x) => dark(x, y))
    if (run > source.width * 0.35) majorHorizontalPixels.push(y)
    if (run > source.width * 0.1) minorHorizontalPixels.push(y)
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

  // 空白节次（尤其是第 7 节）也要保留行号。仅看彩色课程格会把整行空课误判成“非课程横条”，
  // 因此同时检查左侧的“第 N 节/时间”标签。
  const periodLabelRatio = (top: number, bottom: number) => {
    let filled = 0
    let total = 0
    for (let y = top + 4; y < bottom - 4; y += 2) {
      for (let x = 28; x < dayBounds[0] - 4; x += 2) {
        filled += dark(x, y) ? 1 : 0
        total += 1
      }
    }
    return total ? filled / total : 0
  }

  const leftStructuralLines = verticalLines.filter((x) => (
    x > source.width * 0.02 && x < dayBounds[0] - source.width * 0.03
  ))
  const periodDivider = leftStructuralLines.length >= 2 ? leftStructuralLines.at(-1) : undefined
  const verticalDividerRatio = (x: number, top: number, bottom: number) => {
    let filled = 0
    let total = 0
    for (let y = top + 3; y < bottom - 3; y += 1) {
      let linePixel = false
      for (let scanX = Math.max(0, x - 1); scanX <= Math.min(source.width - 1, x + 1); scanX += 1) {
        if (dark(scanX, y)) linePixel = true
      }
      filled += linePixel ? 1 : 0
      total += 1
    }
    return total ? filled / total : 0
  }

  const periodRows = majorLines.slice(1, -1)
    .map((top, index) => ({ top, bottom: majorLines[index + 2] }))
    .filter((row) => {
      if (row.top < headerBottom || row.bottom - row.top < 20) return false
      const looksLikeCourseRow = fillRatio(row.top, row.bottom) > 0.15
      const hasPeriodLabel = row.bottom - row.top >= 40 && periodLabelRatio(row.top, row.bottom) > 0.012
      // 午休/早自习等横向合并的提示行通常没有周一至周五之间的竖线。
      // 仅当 4 条星期分隔线全部缺失时跳过；普通空课程行仍有完整竖线，不受影响。
      const weekdayDividers = dayBounds.slice(1, 5)
      const intactWeekdayDividers = weekdayDividers.filter(
        (x) => verticalDividerRatio(x, row.top, row.bottom) > 0.48,
      ).length
      if (intactWeekdayDividers === 0) return false
      // 有独立“节次 / 时间”两列时，用两列之间的竖线排除非课程横条。
      if (periodDivider !== undefined) return verticalDividerRatio(periodDivider, row.top, row.bottom) > 0.55
      return looksLikeCourseRow || hasPeriodLabel
    })
    .slice(0, 8)
  if (periodRows.length < 3) return null

  // 只对带有明确“早自习”行的课表启用特殊处理；普通课表仍使用旧版行号，
  // 避免上一版按不完整节次 OCR 推算导致的回归。
  // 左侧标签只读第一行，不能因为其他行 OCR 不清晰就重排所有课程。
  let leadingStudyRow = false
  if (periodRows.length >= 2) {
    const first = periodRows[0]
    const labelRight = Math.max(24, dayBounds[0] - 4)
    try {
      await worker.setParameters({ tessedit_pageseg_mode: '7' })
      const labelImage = await createOriginalCell(source, 8, first.top + 2, labelRight, first.bottom - 2, 3)
      const labelResult = await worker.recognize(labelImage, {}, { text: true })
      const label = String(labelResult.data?.text ?? '').replace(/\s+/g, '')
      leadingStudyRow = /早.{0,2}习|早读|晨读|自习/.test(label)
    } catch (error) {
      console.warn('早自习行检测失败，保持原有节次', error)
    }
  }
  const courseRows = leadingStudyRow ? periodRows.slice(1) : periodRows
  const slots: Slot[] = []
  const rawLines: string[] = []
  rawLines.push(`网格边界：原始竖线 [${verticalLines.join(', ')}]；星期边界 [${dayBounds.join(', ')}]`)
  rawLines.push(`图片宽度：${source.width}；右边界：${rightmostTableLine ?? '无'}；右边界比例：${rightmostTableLine === undefined ? '无' : (rightmostTableLine / source.width).toFixed(3)}`)
  rawLines.push(`识别课程行：${periodRows.length}；跳过早自习：${leadingStudyRow ? '是' : '否'}`)
  if (leadingStudyRow) rawLines.push('检测到早自习行，已跳过，不计入第一节')
  const recognizedCells = new Map<string, { course: string; raw: string }>()
  const totalCells = courseRows.length * 5
  let completed = 0
  let activePageSegmentation = '7'

  const hasCellDivider = (left: number, right: number, y: number) => {
    let darkCount = 0
    let total = 0
    for (let scanY = Math.max(0, y - 1); scanY <= Math.min(source.height - 1, y + 1); scanY += 1) {
      for (let x = left + 8; x < right - 8; x += 2) {
        darkCount += dark(x, scanY) ? 1 : 0
        total += 1
      }
    }
    return total > 0 && darkCount / total > 0.18
  }

  for (let rowIndex = 0; rowIndex < courseRows.length; rowIndex += 1) {
    const row = courseRows[rowIndex]
    const rowHeight = row.bottom - row.top
    for (let column = 0; column < 5; column += 1) {
      const left = dayBounds[column] + 3
      const right = dayBounds[column + 1] - 3
      const top = row.top + 3
      const bottom = row.bottom - 3
      const courseLineBottom = Math.min(bottom, top + Math.max(18, Math.floor(rowHeight * 0.55)))
      const textBottom = Math.min(bottom, top + Math.max(20, Math.floor(rowHeight * 0.72)))
      const variants: Array<{ bottom: number; threshold?: number; originalScale?: number; pageSegmentation?: string }> = [
        // 居中的短课名在上半格裁剪中会被截断，先读完整单元格。
        { bottom },
        { bottom, threshold: 140 },
        { bottom, originalScale: 1 },
        { bottom, originalScale: 1, pageSegmentation: '7' },
        { bottom: textBottom },
        { bottom: courseLineBottom },
      ]
      const rawValues: string[] = []
      let course = ''
      let bestCourse = { name: '', evidence: 0 }
      for (const variant of variants) {
        // 课程标题上半行用 SINGLE_LINE；完整单元格（课程名 + 教师/说明）改用 SINGLE_BLOCK，
        // 避免“数学”这类短标题被第二行文字或边框干扰后直接返回空结果。
        const pageSegmentation = variant.pageSegmentation ?? (variant.bottom === bottom ? '6' : '7')
        if (pageSegmentation !== activePageSegmentation) {
          await worker.setParameters({ tessedit_pageseg_mode: pageSegmentation })
          activePageSegmentation = pageSegmentation
        }
        const blob = variant.originalScale
          ? await createOriginalCell(source, left, top, right, variant.bottom, variant.originalScale)
          : await createEnhancedCell(source, left, top, right, variant.bottom, variant.threshold)
        const result = await worker.recognize(blob, {}, { text: true })
        const rawValue = String(result.data?.text ?? '').replace(/\s+/g, '')
        if (rawValue) rawValues.push(rawValue)
        const candidate = matchGridCourse(rawValue)
        bestCourse = preferCourse(rawValue, candidate, bestCourse)
        course = bestCourse.name
        // 长课程名通常只能在完整单元格裁剪中识别出来，拿到完整标题后不再用短候选覆盖它。
        if (candidate === '基本托管A：校内选修课') {
          course = candidate
          break
        }
      }

      // 对空白结果额外尝试放大原图与稀疏文本模式。
      // 只在原有多轮识别都没有命中时运行，不改变其他已正确识别的课程。
      if (!course) {
        for (const scale of [2, 3]) {
          for (const segmentation of ['6', '11']) {
            if (activePageSegmentation !== segmentation) {
              await worker.setParameters({ tessedit_pageseg_mode: segmentation })
              activePageSegmentation = segmentation
            }
            const retryBlob = await createOriginalCell(source, left, top, right, bottom, scale)
            const retryResult = await worker.recognize(retryBlob, {}, { text: true })
            const retryRaw = String(retryResult.data?.text ?? '').replace(/\s+/g, '')
            if (retryRaw) rawValues.push(retryRaw)
            bestCourse = preferCourse(retryRaw, matchGridCourse(retryRaw), bestCourse)
            course = bestCourse.name
            if (course) break
          }
          if (course) break
        }
      }

      // 换行课程（如“班会与 / 心理健康”）可能被单行 OCR 只读成“班会”。
      // 仅在本格已有“班会”证据时，补读下半格；只有识别到“心理健康”才合并。
      if (rawValues.some((value) => value.includes('班会')) &&
          !rawValues.some((value) => value.includes('心理健康'))) {
        const lowerTop = Math.min(bottom - 8, top + Math.floor((bottom - top) * 0.35))
        for (const segmentation of ['6', '11']) {
          if (activePageSegmentation !== segmentation) {
            await worker.setParameters({ tessedit_pageseg_mode: segmentation })
            activePageSegmentation = segmentation
          }
          const lowerBlob = await createOriginalCell(source, left, lowerTop, right, bottom, 2)
          const lowerResult = await worker.recognize(lowerBlob, {}, { text: true })
          const lowerRaw = String(lowerResult.data?.text ?? '').replace(/\s+/g, '')
          if (lowerRaw) rawValues.push(lowerRaw)
          if (lowerRaw.includes('心理健康')) break
        }
      }
      if (rawValues.some((value) => value.includes('班会')) &&
          rawValues.some((value) => value.includes('心理健康'))) {
        const originalDot = rawValues.some((value) => /班会[·•・]心理健康/.test(value))
        const originalAnd = rawValues.some((value) => /班会与心理健康|班会与$|^与心理健康/.test(value))
        const combined = originalDot && !originalAnd ? '班会 · 心理健康' : '班会与心理健康'
        course = rawValues.some((value) => value.includes('升旗'))
          ? `${combined}（含升旗仪式）` : combined
      }

      // “英语/英语口语”是同一单元格的完整课程名，不能只保留 OCR
      // 多次识别中先命中的“英语”或“英语口语”。尝试对完整格进行稀疏文本识别，
      // 并综合本格各次识别结果；仅有双课程或分隔符证据时才合并。
      if (rawValues.some((value) => value.includes('英语')) &&
          !rawValues.some((value) => /英语\s*[/／、|｜]\s*英语口语/.test(value))) {
        for (const segmentation of ['11', '3']) {
          if (activePageSegmentation !== segmentation) {
            await worker.setParameters({ tessedit_pageseg_mode: segmentation })
            activePageSegmentation = segmentation
          }
          const englishBlob = await createOriginalCell(source, left, top, right, bottom, 2)
          const englishResult = await worker.recognize(englishBlob, {}, { text: true })
          const englishRaw = String(englishResult.data?.text ?? '').replace(/\s+/g, '')
          if (englishRaw) rawValues.push(englishRaw)
          if (/英语\s*[/／、|｜]\s*英语口语/.test(englishRaw)) break
        }
      }
      // 实际识别原文中，周一第5节出现“英语上语口语”“英庄&语口语”
      // “英语|不语口语”：OCR 将分隔符及第二个“英”误读。
      // 仅当同一个单元格里同时出现前缀和“语口语”后缀时纠正，
      // 不把单独的“英语”或“英语口语”强制改为组合课程。
      const englishWrapped = rawValues.some((value) =>
        /英语.{0,3}语口语|英[语庄].{0,3}语口语/.test(value))
      const englishFull = rawValues.some((value) =>
        /英语\s*[/／、|｜]\s*英语口语|英语英语口语/.test(value))
      const englishSlash = rawValues.some((value) => /英语\s*[/／|｜]/.test(value))
      const englishSpoken = rawValues.some((value) => value.includes('英语口语'))
      const englishPlain = rawValues.some((value) => /英语(?!口语)/.test(value))
      if (englishFull || englishWrapped || (englishSlash && englishSpoken) ||
          (englishPlain && englishSpoken && rawValues.some((value) => /[/／|｜]/.test(value)))) {
        course = '英语/英语口语'
      }

      // 第 7 节一格内会再用竖线分成左右两个课程，例如“延时服务｜素质拓展”。
      // 整格 OCR 往往只读到左半边，因此检测内部竖线后分别识别两半并合并结果。
      const cellWidth = right - left
      // 内部分隔线很短且可能因压缩断开，按当前行检测，不依赖全图长竖线候选。
      const internalPixels: number[] = []
      for (let x = Math.ceil(left + cellWidth * 0.3); x < right - cellWidth * 0.3; x += 1) {
        if (verticalDividerRatio(x, row.top, row.bottom) > 0.75) internalPixels.push(x)
      }
      const internalDivider = groupLinePositions(internalPixels)
        .sort((a, b) => Math.abs(a - (left + right) / 2) - Math.abs(b - (left + right) / 2))[0]
      if (internalDivider !== undefined) {
        if (activePageSegmentation !== '6') {
          await worker.setParameters({ tessedit_pageseg_mode: '6' })
          activePageSegmentation = '6'
        }
        const splitCourses: string[] = []
        for (const [splitLeft, splitRight] of [[left, internalDivider - 2], [internalDivider + 2, right]]) {
          let splitBest = { name: '', evidence: 0 }
          for (const variant of [{ originalScale: 1 }, { originalScale: 2 }, {}, { threshold: 140 }]) {
            const splitBlob = variant.originalScale
              ? await createOriginalCell(source, splitLeft, top, splitRight, bottom, variant.originalScale)
              : await createEnhancedCell(source, splitLeft, top, splitRight, bottom, variant.threshold)
            const splitResult = await worker.recognize(splitBlob, {}, { text: true })
            const splitRaw = String(splitResult.data?.text ?? '').replace(/\s+/g, '')
            if (splitRaw) rawValues.push(splitRaw)
            const candidate = matchGridCourse(splitRaw)
            splitBest = preferCourse(splitRaw, candidate, splitBest)
          }
          const splitCourse = splitBest.name
          if (splitCourse) splitCourses.push(splitCourse)
        }
        const uniqueSplitCourses = Array.from(new Set(splitCourses))
        if (uniqueSplitCourses.length >= 2) course = uniqueSplitCourses.join(' / ')
        else if (uniqueSplitCourses.length === 1) {
          const splitCourse = uniqueSplitCourses[0]
          if (!course) course = splitCourse
          else if (!course.includes(splitCourse)) course = `${course} / ${splitCourse}`
        }
      }
      const raw = Array.from(new Set(rawValues)).join(' / ')
      const cellKey = `${column + 1}-${rowIndex + 1}`
      if (course) {
        recognizedCells.set(cellKey, { course, raw })
        rawLines.push(`${DAY_NAMES[column + 1]} 第${rowIndex + 1}节：${raw} → ${course}`)
      } else if (raw) rawLines.push(`${DAY_NAMES[column + 1]} 第${rowIndex + 1}节：${raw}（未采用）`)
      completed += 1
      onProgress(12 + Math.round((completed / totalCells) * 82), `正在逐格读取课程（${completed}/${totalCells}）…`)
    }
  }

  // 课程表会使用纵向合并单元格（本图周一第 6、7 节的“身心成长”）。
  // 只有当相邻两行之间在该列确实没有横线时才向下延展，避免把普通空课误填成上一节课程。
  for (let rowIndex = 1; rowIndex < courseRows.length; rowIndex += 1) {
    for (let column = 0; column < 5; column += 1) {
      const currentKey = `${column + 1}-${rowIndex + 1}`
      if (recognizedCells.has(currentKey)) continue
      const previousKey = `${column + 1}-${rowIndex}`
      const previous = recognizedCells.get(previousKey)
      const boundary = courseRows[rowIndex].top
      if (!previous || hasCellDivider(dayBounds[column], dayBounds[column + 1], boundary)) continue
      recognizedCells.set(currentKey, { course: previous.course, raw: `${previous.raw}（合并单元格）` })
      rawLines.push(`${DAY_NAMES[column + 1]} 第${rowIndex + 1}节：${previous.course}（合并单元格） → ${previous.course}`)
    }
  }

  for (const [key, value] of recognizedCells) {
    const [day, period] = key.split('-').map(Number)
    slots.push({ id: uid(), day, period, name: value.course })
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

  const noisePattern = /课程|课表|节次|时间|午休|早读|班级|姓名|上午|下午|教师|教室|星期|礼拜|周次|眼保健操|大课间|自由阅读|自律/
  const content = words.filter((word) => {
    const name = normalizeCourseName(word.text).replace(/[^\p{L}\p{N}]/gu, '')
    return (
      word.y > headerBottom &&
      word.x > firstDayX - dayStep * 0.55 &&
      name.length >= 1 &&
      word.confidence >= 5 &&
      !noisePattern.test(name) &&
      !/^(?:第)?\d+(?:节|课)?$/.test(name) &&
      !/^[-—_=+]+$/.test(name) &&
      // 仅过滤纯小写字母噪声（smmm/ay），保留「基本托管A」中的大写 A
      !/^[a-z|｜]+$/.test(name) &&
      !/^[A-Z]{2,}$/.test(name)
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
    const combined = stripNoiseChars(normalizeCourseName(
      Array.from(new Set(cellWords.sort((a, b) => a.x - b.x).map((word) => word.text))).join(''),
    ).replace(/[^\p{L}\p{N}]/gu, ''))
    const name = matchGridCourse(combined) || combined.replace(/(?:老师|教师|教室|校区).*$/, '').slice(0, 18)
    return { id: uid(), day, period, name }
  }).filter((slot) => (slot.name.length >= 2 || slot.name === '康') && !noisePattern.test(slot.name))

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
    setProgress(0)
    setStatus('正在准备识别…')
    let worker: any = null
    let cellRecognition = false
    try {
      const { createWorker, OEM, PSM } = await import('tesseract.js')
      worker = await new Promise((resolve, reject) => createWorker('chi_sim', OEM.LSTM_ONLY, {
        workerPath: '/ocr/tesseract-7.0.0/worker.min.js',
        corePath: '/ocr/tesseract-7.0.0',
        langPath: '/ocr/tesseract-7.0.0',
        workerBlobURL: false,
        // 初始化语言包失败也要进入页面的错误提示，避免库抛出未处理错误或一直等待。
        errorHandler: reject,
        logger: (message: any) => {
          if (!cellRecognition && typeof message.progress === 'number') setProgress(Math.round(message.progress * 100))
          if (!cellRecognition && message.status === 'recognizing text') setStatus('正在读取课程名称…')
          else if (message.status === 'loading language traineddata') setStatus('首次使用，正在加载中文识别包…')
        },
      }).then(resolve, reject))
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.SINGLE_LINE,
        user_defined_dpi: '300',
      })
      cellRecognition = true
      // 网格检测失败不应导致整次导入失败：保留原有整图识别兜底。
      let gridResult: Awaited<ReturnType<typeof recognizeGridTimetable>> = null
      try {
        gridResult = await recognizeGridTimetable(file, worker, (nextProgress, nextStatus) => {
          setProgress(nextProgress)
          setStatus(nextStatus)
        })
      } catch (gridError) {
        console.warn('课程表网格识别失败，尝试整图识别', gridError)
      }
      let inferred: { slots: Slot[]; candidates: string[]; rawText: string }
      // 只要网格定位成功且至少读到一格，就保留逐格结果。
      // 低于 8 格并不代表网格失败：空课、合并格和低对比度单元格都可能让数量暂时偏少；
      // 直接退回整张图 OCR 会丢失列/节次关系，反而更容易出现整列错位。
      if (gridResult && gridResult.slots.length > 0) {
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
      const detail = reason instanceof Error ? reason.message : String(reason ?? '')
      setError((worker
        ? '识别没有成功。'
        : '识别程序加载失败。') + (detail ? ` 错误信息：${detail.slice(0, 180)}` : ' 请刷新页面后重试。'))
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
  const readingStatusMatch = /^正在逐格读取课程（(\d+\/\d+)）/.exec(status)
  const readingStatusLabel = readingStatusMatch ? '正在逐格读取课程' : status
  const readingStatusCount = readingStatusMatch?.[1]

  return (
    <div className="sheet-backdrop" role="dialog" aria-modal="true">
      <div className="sheet import-sheet">
        <div className="sheet-handle" />
        <div className="sheet-header">
          {step !== 'pick' ? <button className="icon-button" onClick={() => setStep('pick')}><ChevronLeft size={21} /></button> : <div />}
          <div className="sheet-heading"><h2>{step === 'review' ? '校对课程表' : '上传课程表'}</h2>{step === 'pick' && <p className="sheet-subtitle">拍下课程表，闪闪来帮你整理呀</p>}</div>
          <button className="icon-button" onClick={onClose}><X size={21} /></button>
        </div>
        {step === 'pick' && (
          <div className="sheet-body">
            <button className={preview ? 'upload-zone has-image' : 'upload-zone'} onClick={() => inputRef.current?.click()}>
              {preview ? <img src={preview} alt="课程表预览" /> : <><span><ImagePlus size={29} /></span><h3>点击选择课程表</h3><p>支持课程表截图或清晰照片</p></>}
            </button>
            <input ref={inputRef} className="visually-hidden" type="file" accept="image/*" onChange={(event) => chooseFile(event.target.files?.[0])} />
            {error && <p className="error-message">{error}</p>}
            <div className="tip-list"><p><Check size={16} />尽量裁掉课程表外的其他内容</p><p><Check size={16} />光线均匀，文字越清楚越好</p><p><Check size={16} />识别后还可以逐项修改</p></div>
            <button className="primary-button wide" onClick={() => { if (file) void recognize(); else inputRef.current?.click() }}><Sparkles size={18} />{file ? '开始识别' : '从相册选择'}</button>
            <button className="text-button" onClick={useDemo}>暂时没有图片？试用示例课程表</button>
          </div>
        )}
        {step === 'reading' && (
          <div className="reading-state">
            <div className="scan-preview">{preview && <img src={preview} alt="正在识别的课程表" />}<span /></div>
            <LoaderCircle className="spin" size={27} aria-hidden="true" />
            <div className="reading-status-line">
              <h3>{readingStatusLabel}</h3>
              {readingStatusCount && <span className="reading-progress-badge">{readingStatusCount}</span>}
            </div>
            <p>✨ 整个过程通常需要 10～30 秒</p>
            <div className="progress"><span style={{ width: `${Math.max(6, progress)}%` }} /></div>
            <strong>{progress}%</strong>
          </div>
        )}
        {step === 'review' && (
          <div className="sheet-body review-body">
            <div className={draft.length ? 'review-note' : 'review-note needs-help'}>
              <ListChecks size={18} />
              <p>
                <strong>{draft.length ? `已帮你整理好 ${draft.length} 节课` : candidates.length ? '识别到课程名，但无法确定位置' : '图片文字不够清晰'}</strong>
                <span>{draft.length ? '请按星期检查，点错的地方可以直接修改。' : candidates.length ? '选择星期，再点下方课程名，或直接填写对应节次。' : '可以返回重拍，或者在下方直接填写课程。'}</span>
              </p>
            </div>
            <div className="day-tabs compact">{SCHOOL_DAYS.map((item) => <button key={item} className={day === item ? 'active' : ''} onClick={() => setDay(item)}><span>{DAY_NAMES[item].slice(1)}</span></button>)}</div>
            <div className="period-list compact-list">{PERIODS.map((period) => {
              const slot = draft.find((item) => item.day === day && item.period === period)
              return <label className="period-row" key={`${day}-${period}`}><span>{period}</span><input value={slot?.name ?? ''} onChange={(event) => updateDraft(period, event.target.value)} placeholder="无课程" /></label>
            })}</div>
            {candidates.length > 0 && <div className="candidate-box"><p><strong>快速补充课程</strong><span>点击添加到{DAY_NAMES[day]}</span></p><div>{candidates.slice(0, 20).map((name) => <button key={name} onClick={() => { const empty = PERIODS.find((period) => !draft.some((slot) => slot.day === day && slot.period === period)); if (empty) updateDraft(empty, name) }}>{name}<Plus size={13} /></button>)}</div></div>}
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

