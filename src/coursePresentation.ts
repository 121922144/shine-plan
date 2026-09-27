const SUBJECT_EMOJI: Array<[RegExp, string]> = [
  [/语文|阅读/, '📖'],
  [/数学/, '➗'],
  [/英语/, '🔤'],
  [/体育|体活/, '🏀'],
  [/道德|法治/, '⚖️'],
  [/科学/, '🔬'],
  [/音乐/, '🎵'],
  [/美术/, '🎨'],
  [/书法/, '🖌️'],
  [/心理|成长/, '🌱'],
]

export const PERIOD_TIMES = ['08:00 - 08:45', '08:55 - 09:40', '10:00 - 10:45', '11:00 - 11:45', '14:00 - 14:45', '15:00 - 15:45', '16:00 - 16:45', '17:00 - 17:45']
export const PERIOD_TONES = ['orange', 'purple', 'orange', 'blue', 'green', 'indigo', 'rose', 'cyan']

export function courseEmoji(subject: string) {
  return SUBJECT_EMOJI.find(([pattern]) => pattern.test(subject))?.[1] ?? '📚'
}

export function periodTime(period: number) {
  return PERIOD_TIMES[period - 1] ?? `第 ${period} 节`
}

export function periodTone(period: number) {
  return PERIOD_TONES[(period - 1) % PERIOD_TONES.length]
}
