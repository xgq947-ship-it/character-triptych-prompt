import assert from 'node:assert/strict'
import test from 'node:test'
import {
  extractJsonText,
  parseOptimizeResponse,
} from '../src/providers/parseOptimizeResponse.ts'

const VALID_RESULT = {
  prompt: 'Three studio photographs of the same person.',
  panels: {
    left: 'Front full-body.',
    middle: 'Back full-body.',
    right: 'Close-up portrait.',
  },
  identityAnchors: ['Same real person in all three panels.'],
  wardrobe: 'Charcoal jacket, consistent in all panels.',
  assumptions: ['默认使用中性灰背景。'],
  notes: '在平台中选择 16:9 与 2k。',
}

test('extracts a JSON object from a fenced response', () => {
  const raw = 'Here is the result:\n\n```json\n' + JSON.stringify(VALID_RESULT) + '\n```'
  assert.equal(JSON.parse(extractJsonText(raw)).prompt, VALID_RESULT.prompt)
})

test('parses a complete optimization result', () => {
  const raw = JSON.stringify(VALID_RESULT)
  const parsed = parseOptimizeResponse(raw)
  assert.equal(parsed.prompt, VALID_RESULT.prompt)
  assert.deepEqual(parsed.panels, VALID_RESULT.panels)
  assert.equal(parsed.rawResponse, raw)
  assert.equal(parsed.parseWarning, undefined)
})

test('keeps raw output when JSON parsing fails', () => {
  const parsed = parseOptimizeResponse('not-json-at-all')
  assert.equal(parsed.prompt, '')
  assert.equal(parsed.rawResponse, 'not-json-at-all')
  assert.match(parsed.parseWarning, /不是有效 JSON/)
})

test('reports missing contract fields without throwing', () => {
  const parsed = parseOptimizeResponse(JSON.stringify({ prompt: 'partial' }))
  assert.equal(parsed.prompt, 'partial')
  assert.match(parsed.parseWarning, /panels.left/)
  assert.match(parsed.parseWarning, /wardrobe/)
})
