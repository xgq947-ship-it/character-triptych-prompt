import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CHARACTER_TRIPTYCH_JSON_SCHEMA,
  CHARACTER_TRIPTYCH_RULES_VERSION,
  CHARACTER_TRIPTYCH_SYSTEM_PROMPT,
  buildCharacterTriptychUserPrompt,
} from '../src/prompts/characterTriptych.ts'

test('triptych rules are versioned and limited to the character branch', () => {
  assert.match(CHARACTER_TRIPTYCH_RULES_VERSION, /^\d+\.\d+\.\d+$/)
  assert.ok(CHARACTER_TRIPTYCH_SYSTEM_PROMPT.length > 1200)
  assert.match(CHARACTER_TRIPTYCH_SYSTEM_PROMPT, /same real person in all three panels/i)
  assert.match(CHARACTER_TRIPTYCH_SYSTEM_PROMPT, /consistent across panels/i)
  assert.doesNotMatch(CHARACTER_TRIPTYCH_SYSTEM_PROMPT, /Soul Cinema|\bNBP\b|Seedream|GPT Image/i)
})

test('reference mode anchors identity to the later uploaded image', () => {
  const prompt = buildCharacterTriptychUserPrompt({
    characterDescription: '一位冷静的年轻建筑师',
    hasReferenceImage: true,
  })
  assert.match(prompt, /REFERENCE-ANCHORED/)
  assert.match(prompt, /uploaded reference image/i)
  assert.match(prompt, /facial features, hairstyle, body proportions/i)
})

test('text-only mode requests a complete generated identity', () => {
  const prompt = buildCharacterTriptychUserPrompt({
    characterDescription: '一位冷静的年轻建筑师',
    hasReferenceImage: false,
  })
  assert.match(prompt, /TEXT-GENERATED/)
  assert.match(prompt, /age range/)
  assert.match(prompt, /height, build, face shape/)
  assert.doesNotMatch(prompt, /REFERENCE-ANCHORED/)
})

test('Codex output schema contains the complete result contract', () => {
  assert.equal(CHARACTER_TRIPTYCH_JSON_SCHEMA.type, 'object')
  assert.deepEqual(
    CHARACTER_TRIPTYCH_JSON_SCHEMA.required,
    ['prompt', 'panels', 'identityAnchors', 'wardrobe', 'assumptions', 'notes'],
  )
  assert.deepEqual(
    CHARACTER_TRIPTYCH_JSON_SCHEMA.properties.panels.required,
    ['left', 'middle', 'right'],
  )
})
