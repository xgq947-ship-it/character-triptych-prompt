export type ProviderId = 'deepseek' | 'codex-cli'
export type DeepSeekModel = 'deepseek-v4-flash' | 'deepseek-v4-pro'
export type AppView = 'optimizer' | 'history' | 'settings'
export type OptimizationStage = 'idle' | 'checking' | 'optimizing' | 'completed' | 'error'

export interface OptimizeInput {
  characterDescription: string
  hasReferenceImage: boolean
}

export interface OptimizeResult {
  prompt: string
  panels: {
    left: string
    middle: string
    right: string
  }
  identityAnchors: string[]
  wardrobe: string
  assumptions: string[]
  notes?: string
  rawResponse: string
  parseWarning?: string
}

export interface Settings {
  defaultProvider: ProviderId
  deepseekApiKey: string
  deepseekModel: DeepSeekModel
  codexTimeoutSeconds: number
  saveHistory: boolean
  maxHistory: number
}

export interface ProviderAvailability {
  available: boolean
  checking?: boolean
  message: string
  version?: string
  path?: string
}

export interface HistoryItem {
  id: string
  timestamp: number
  providerId: ProviderId
  hasReferenceImage: boolean
  characterDescription: string
  rulesVersion: string
  result: OptimizeResult
}

export const DEFAULT_SETTINGS: Settings = {
  defaultProvider: 'codex-cli',
  deepseekApiKey: '',
  deepseekModel: 'deepseek-v4-flash',
  codexTimeoutSeconds: 120,
  saveHistory: true,
  maxHistory: 50,
}

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  deepseek: 'DeepSeek API',
  'codex-cli': '本地 Codex CLI',
}
