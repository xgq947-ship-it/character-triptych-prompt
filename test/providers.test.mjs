import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildCodexExecuteRequest,
  createCodexCliProvider,
} from '../src/providers/codexCliProvider.ts'
import { createDeepSeekProvider } from '../src/providers/deepseekProvider.ts'

const VALID_RESPONSE = JSON.stringify({
  prompt: 'Complete triptych prompt.',
  panels: { left: 'Front.', middle: 'Back.', right: 'Close-up.' },
  identityAnchors: ['Same person.'],
  wardrobe: 'Consistent charcoal wardrobe.',
  assumptions: ['默认年龄为 30 岁。'],
  notes: '',
})

test('DeepSeek provider passes prompts through its injected transport', async () => {
  let captured
  const provider = createDeepSeekProvider({
    apiKey: 'sk-local-test',
    model: 'deepseek-v4-flash',
    transport: async (request) => {
      captured = request
      return VALID_RESPONSE
    },
  })
  assert.equal(await provider.isAvailable(), true)
  const result = await provider.optimize({
    characterDescription: '一名图书管理员',
    hasReferenceImage: false,
  })
  assert.equal(result.prompt, 'Complete triptych prompt.')
  assert.equal(captured.model, 'deepseek-v4-flash')
  assert.match(captured.systemPrompt, /JSON only/i)
  assert.match(captured.userPrompt, /图书管理员/)
})

test('DeepSeek provider is unavailable without a key', async () => {
  const provider = createDeepSeekProvider({
    apiKey: ' ',
    model: 'deepseek-v4-flash',
    transport: async () => VALID_RESPONSE,
  })
  assert.equal(await provider.isAvailable(), false)
  await assert.rejects(
    provider.optimize({ characterDescription: '角色', hasReferenceImage: false }),
    /API Key/,
  )
})

test('Codex request keeps hostile-looking user text inside stdin prompt data', () => {
  const backtick = String.fromCharCode(96)
  const description = '人物"; touch /tmp/pwned; $(open bad) ' + backtick + 'whoami' + backtick
  const request = buildCodexExecuteRequest(
    { characterDescription: description, hasReferenceImage: true },
    120,
  )
  assert.match(request.prompt, /touch \/tmp\/pwned/)
  assert.doesNotMatch(request.outputSchema, /touch \/tmp\/pwned/)
  assert.equal(request.timeoutSeconds, 120)
  assert.doesNotThrow(() => JSON.parse(request.outputSchema))
})

test('Codex provider uses status and execute transport without a shell command', async () => {
  let captured
  const provider = createCodexCliProvider({
    timeoutSeconds: 90,
    transport: {
      status: async () => ({ available: true, message: 'ready' }),
      execute: async (request) => {
        captured = request
        return VALID_RESPONSE
      },
    },
  })
  const result = await provider.optimize({
    characterDescription: '一名钟表匠',
    hasReferenceImage: false,
  })
  assert.equal(result.panels.middle, 'Back.')
  assert.equal(captured.timeoutSeconds, 90)
  assert.ok(Object.hasOwn(captured, 'prompt'))
  assert.ok(!Object.hasOwn(captured, 'command'))
})

test('Codex provider reports an unavailable local CLI clearly', async () => {
  const provider = createCodexCliProvider({
    timeoutSeconds: 60,
    transport: {
      status: async () => ({ available: false, message: '未检测到 Codex CLI' }),
      execute: async () => VALID_RESPONSE,
    },
  })
  await assert.rejects(
    provider.optimize({ characterDescription: '角色', hasReferenceImage: false }),
    /未检测到 Codex CLI/,
  )
})
