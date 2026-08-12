import {
  CHARACTER_TRIPTYCH_SYSTEM_PROMPT,
  buildCharacterTriptychUserPrompt,
} from '../prompts/characterTriptych'
import type { DeepSeekModel, OptimizeInput } from '../types'
import { parseOptimizeResponse } from './parseOptimizeResponse'
import { ProviderError } from './types'
import type { OptimizeProvider } from './types'

export interface DeepSeekTransportRequest {
  apiKey: string
  model: DeepSeekModel
  systemPrompt: string
  userPrompt: string
}

export type DeepSeekTransport = (request: DeepSeekTransportRequest) => Promise<string>

interface DeepSeekProviderOptions {
  apiKey: string
  model: DeepSeekModel
  transport: DeepSeekTransport
}

export function createDeepSeekProvider(options: DeepSeekProviderOptions): OptimizeProvider {
  return {
    id: 'deepseek',

    async isAvailable() {
      return Boolean(options.apiKey.trim())
    },

    async optimize(input: OptimizeInput) {
      if (!input.characterDescription.trim()) {
        throw new ProviderError('invalid-input', '请先输入人物描述。')
      }
      if (!options.apiKey.trim()) {
        throw new ProviderError('unavailable', '尚未配置 DeepSeek API Key，请先前往设置。')
      }

      try {
        const rawResponse = await options.transport({
          apiKey: options.apiKey.trim(),
          model: options.model,
          systemPrompt: CHARACTER_TRIPTYCH_SYSTEM_PROMPT,
          userPrompt: buildCharacterTriptychUserPrompt(input),
        })
        return parseOptimizeResponse(rawResponse)
      } catch (error) {
        if (error instanceof ProviderError) throw error
        const message = error instanceof Error ? error.message : String(error)
        throw new ProviderError('request-failed', message || 'DeepSeek 请求失败。')
      }
    },
  }
}
