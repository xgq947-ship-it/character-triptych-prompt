import { invoke } from '@tauri-apps/api/core'
import type { DeepSeekTransport, DeepSeekTransportRequest } from '../providers/deepseekProvider'
import type { CodexCliTransport, CodexExecuteRequest } from '../providers/codexCliProvider'
import type { ProviderAvailability } from '../types'

export const isTauriRuntime = (
  typeof window !== 'undefined'
  && '__TAURI_INTERNALS__' in window
)

function desktopOnlyError(): Error {
  return new Error('此功能需要在桌面应用中运行。')
}

export const deepSeekTransport: DeepSeekTransport = async (
  request: DeepSeekTransportRequest,
) => {
  if (!isTauriRuntime) throw desktopOnlyError()
  return invoke<string>('deepseek_optimize', { request })
}

export async function testDeepSeekConnection(apiKey: string): Promise<string> {
  if (!isTauriRuntime) throw desktopOnlyError()
  return invoke<string>('deepseek_test_connection', { apiKey })
}

export const codexCliTransport: CodexCliTransport = {
  async status(): Promise<ProviderAvailability> {
    if (!isTauriRuntime) {
      return {
        available: false,
        message: '请在 Tauri 桌面应用中检测 Codex CLI。',
      }
    }
    return invoke<ProviderAvailability>('codex_cli_status')
  },

  async execute(request: CodexExecuteRequest): Promise<string> {
    if (!isTauriRuntime) throw desktopOnlyError()
    return invoke<string>('codex_cli_optimize', { request })
  },
}
