import {
  CHARACTER_TRIPTYCH_JSON_SCHEMA,
  buildCodexCliPrompt,
} from '../prompts/characterTriptych'
import type { OptimizeInput, ProviderAvailability } from '../types'
import { parseOptimizeResponse } from './parseOptimizeResponse'
import { ProviderError } from './types'
import type { OptimizeProvider } from './types'

export interface CodexExecuteRequest {
  prompt: string
  outputSchema: string
  timeoutSeconds: number
}

export interface CodexCliTransport {
  status(): Promise<ProviderAvailability>
  execute(request: CodexExecuteRequest): Promise<string>
}

interface CodexCliProviderOptions {
  timeoutSeconds: number
  transport: CodexCliTransport
}

export function buildCodexExecuteRequest(
  input: OptimizeInput,
  timeoutSeconds: number,
): CodexExecuteRequest {
  return {
    prompt: buildCodexCliPrompt(input),
    outputSchema: JSON.stringify(CHARACTER_TRIPTYCH_JSON_SCHEMA),
    timeoutSeconds,
  }
}

export function createCodexCliProvider(options: CodexCliProviderOptions): OptimizeProvider {
  return {
    id: 'codex-cli',

    async isAvailable() {
      return (await options.transport.status()).available
    },

    async optimize(input: OptimizeInput) {
      if (!input.characterDescription.trim()) {
        throw new ProviderError('invalid-input', '请先输入人物描述。')
      }

      const status = await options.transport.status()
      if (!status.available) {
        throw new ProviderError('unavailable', status.message || '未检测到 Codex CLI。')
      }

      try {
        const rawResponse = await options.transport.execute(
          buildCodexExecuteRequest(input, options.timeoutSeconds),
        )
        return parseOptimizeResponse(rawResponse)
      } catch (error) {
        if (error instanceof ProviderError) throw error
        const message = error instanceof Error ? error.message : String(error)
        const code = /超时|timeout/i.test(message) ? 'timeout' : 'request-failed'
        throw new ProviderError(code, message || 'Codex CLI 调用失败。')
      }
    },
  }
}
