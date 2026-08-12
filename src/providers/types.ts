import type { OptimizeInput, OptimizeResult, ProviderId } from '../types'

export interface OptimizeProvider {
  readonly id: ProviderId
  isAvailable(): Promise<boolean>
  optimize(input: OptimizeInput): Promise<OptimizeResult>
}

export class ProviderError extends Error {
  readonly code: 'unavailable' | 'request-failed' | 'timeout' | 'invalid-input'

  constructor(
    code: ProviderError['code'],
    message: string,
  ) {
    super(message)
    this.name = 'ProviderError'
    this.code = code
  }
}
