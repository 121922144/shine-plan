import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import ts from 'typescript'

// Import the actual TS helper without starting a browser or bundling React.
const source = readFileSync(new URL('../src/coursePresentation.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const { courseTimeLabel, courseTimeError, courseStatusAt } =
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
