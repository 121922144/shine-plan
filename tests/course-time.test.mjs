import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import ts from 'typescript'

// Import the actual TS helper without starting a browser or bundling React.
const source = readFileSync(new URL('../src/coursePresentation.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const { courseTimeLabel, courseTimeError, courseStatusAt, applyPeriodTimeToWeek, applyDayTimesToWeek } =
  await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)

const date = new Date(2026, 9, 19, 0, 0, 0)
const slot = { id: '1', day: 1, period: 1, name: '数学', startTime: '08:00', endTime: '08:45' }

test('legacy courses without hours must display no time or status', () => {
  const legacy = { id: 'old', day: 1, period: 1, name: '语文' }
  assert.equal(courseTimeLabel(legacy), '')
  assert.equal(courseStatusAt(legacy, date, new Date(2026, 9, 19, 18)), null)
  assert.equal(courseTimeError(legacy), '')
})

test('saved hours drive the label and finished status at the actual end minute', () => {
  assert.equal(courseTimeLabel(slot), '08:00 - 08:45')
  assert.equal(courseStatusAt(slot, date, new Date(2026, 9, 19, 8, 44)), '待上课')
  assert.equal(courseStatusAt(slot, date, new Date(2026, 9, 19, 8, 45)), '已上课')
  assert.equal(courseStatusAt(slot, new Date(2026, 9, 20), new Date(2026, 9, 19, 23)), '待上课')
  assert.equal(courseStatusAt(slot, new Date(2026, 9, 18), new Date(2026, 9, 19, 7)), '已上课')
})

test('incomplete or invalid hours cannot be mistaken for actual class end time', () => {
  assert.ok(courseTimeError({ startTime: '09:30' }))
  assert.ok(courseTimeError({ endTime: '09:30' }))
  assert.ok(courseTimeError({ startTime: '10:00', endTime: '09:30' }))
  assert.ok(courseTimeError({ startTime: '25:00', endTime: '26:00' }))
  assert.equal(courseTimeLabel({ startTime: '08:00' }), '')
  assert.equal(courseStatusAt({ ...slot, startTime: '09:00', endTime: '08:45' }, date), null)
})

test('cleared hours can be persisted as optional fields', () => {
  assert.equal(courseTimeLabel({ ...slot, startTime: undefined, endTime: undefined }), '')
  assert.equal(courseTimeError({ startTime: undefined, endTime: undefined }), '')
})

const schoolWeek = [
  { id: 'mon-1', day: 1, period: 1, name: '数学', startTime: '08:00', endTime: '08:45' },
  { id: 'mon-2', day: 1, period: 2, name: '语文', startTime: '09:00', endTime: '09:40' },
  { id: 'mon-3', day: 1, period: 3, name: '科学' }, // Unset hours must not erase other days.
  { id: 'tue-1', day: 2, period: 1, name: '美术', startTime: '10:00', endTime: '10:40' },
  { id: 'tue-2', day: 2, period: 2, name: '体育' },
  { id: 'tue-3', day: 2, period: 3, name: '英语', startTime: '11:00', endTime: '11:45' },
  { id: 'wed-1', day: 3, period: 1, name: '音乐' },
  { id: 'thu-2', day: 4, period: 2, name: '书法' },
  { id: 'fri-3', day: 5, period: 3, name: '自习' },
]

test('single period propagation updates only the same class period Monday–Friday', () => {
  const snapshot = structuredClone(schoolWeek)
  const result = applyPeriodTimeToWeek(schoolWeek, 1, 1, {
    startTime: '07:50', endTime: '08:35',
  })
  assert.equal(result.affected, 2)
  const times = result.slots.filter((row) => row.period === 1)
  assert.ok(times.every((row) => row.startTime === '07:50' && row.endTime === '08:35'))
  assert.equal(result.slots.find((row) => row.id === 'tue-1').name, '美术')
  assert.equal(result.slots.find((row) => row.id === 'tue-2').startTime, undefined)
  assert.deepEqual(schoolWeek, snapshot, 'applying times does not mutate input slots')
  assert.equal(result.slots.length, schoolWeek.length, 'copy does not create new courses')
})

test('whole-day propagation applies each configured period but never clears blank periods', () => {
  const result = applyDayTimesToWeek(schoolWeek, 1)
  assert.equal(result.periods, 2)
  assert.equal(result.affected, 4)
  assert.deepEqual(
    result.slots.filter((row) => row.day !== 1 && row.period === 1).map((row) => [row.startTime, row.endTime]),
    [['08:00', '08:45'], ['08:00', '08:45']],
  )
  assert.equal(result.slots.find((row) => row.id === 'tue-2').startTime, '09:00')
  assert.equal(result.slots.find((row) => row.id === 'thu-2').startTime, '09:00')
  assert.equal(result.slots.find((row) => row.id === 'tue-3').startTime, '11:00')
  assert.equal(result.slots.find((row) => row.id === 'fri-3').startTime, undefined)
  assert.equal(result.slots.find((row) => row.id === 'tue-1').name, '美术')
  assert.equal(result.slots.length, schoolWeek.length)
})

test('invalid or missing time is never propagated', () => {
  const empty = applyPeriodTimeToWeek(schoolWeek, 1, 1, {})
  const invalid = applyPeriodTimeToWeek(schoolWeek, 1, 1, { startTime: '09:30', endTime: '09:00' })
  const absent = applyDayTimesToWeek(schoolWeek, 5)
  assert.strictEqual(empty.slots, schoolWeek)
  assert.strictEqual(invalid.slots, schoolWeek)
  assert.strictEqual(absent.slots, schoolWeek)
  assert.equal(absent.affected, 0)
  assert.equal(absent.periods, 0)
})
