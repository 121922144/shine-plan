import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

// Run the actual private OCR helpers without mounting the React import dialog.
const source = await readFile(new URL('../src/features/ImportSheet.tsx', import.meta.url), 'utf8')
const helpers = source.slice(source.indexOf('const DAY_NAMES'), source.indexOf('export function ImportSheet'))
const compiled = ts.transpileModule(helpers, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText
const context = vm.createContext({})
vm.runInContext(compiled, context)
const { matchGridCourse, preferCourse, findEvenlySpacedBounds } = context

test('cut-off short text is not arbitrarily replaced with Chinese', () => {
  for (const raw of ['年灰', '年灵', '(本瘟', '证女', 'abc', '']) assert.equal(matchGridCourse(raw), '')
  assert.equal(matchGridCourse('美术'), '美术')
  assert.equal(matchGridCourse('体育'), '体育')
})

test('exact recognition replaces an earlier same-length fuzzy match', () => {
  const previous = { name: '语文', evidence: 1 }
  assert.equal(preferCourse('美术', matchGridCourse('美术'), previous).name, '美术')
  assert.equal(preferCourse('体育', matchGridCourse('体育'), previous).name, '体育')
})

test('complete split courses survive subsequent shorter recognition', () => {
  const raw = '延时服务 | 素质拓展'
  const full = preferCourse(raw, matchGridCourse(raw), { name: '', evidence: 0 })
  assert.equal(full.name, '延时服务 / 素质拓展')
  assert.equal(preferCourse('延时服务', matchGridCourse('延时服务'), full).name, full.name)
  assert.equal(matchGridCourse('圭质拓展'), '素质拓展')
})

test('retain multiline descriptions and existing short-course support', () => {
  assert.equal(matchGridCourse('班会 心理健康（含升旗仪式）'), '班会 · 心理健康（含升旗仪式）')
  assert.equal(matchGridCourse('基本托管A\n（特色选修）'), '基本托管A（特色选修）')
  assert.equal(matchGridCourse('综合实践\n与劳动'), '综合实践与劳动')
  assert.equal(matchGridCourse('康'), '康')
  assert.equal(matchGridCourse('午餐午休'), '')
})

test('half-width subdivisions are not mistaken for weekday boundaries', () => {
  const lines = [54, 106, 137, 234, 317, 410, 493, 586, 668, 762, 845, 938, 1020, 1113]
  assert.deepEqual(Array.from(findEvenlySpacedBounds(lines, 6, 1170, 0.16)), [234, 410, 586, 762, 938, 1113])
})
