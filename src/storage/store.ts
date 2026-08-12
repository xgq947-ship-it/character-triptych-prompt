import { load } from '@tauri-apps/plugin-store'
import { isTauriRuntime } from '../bridge/tauri'
import type { HistoryItem, Settings } from '../types'
import { DEFAULT_SETTINGS } from '../types'

const STORE_FILE = 'character-triptych-prompt.json'
let storePromise: ReturnType<typeof load> | null = null

function localStore() {
  storePromise ??= load(STORE_FILE, { autoSave: true, defaults: {} })
  return storePromise
}

function normalizeSettings(value: Partial<Settings> | null | undefined): Settings {
  const merged = { ...DEFAULT_SETTINGS, ...value }
  return {
    ...merged,
    codexTimeoutSeconds: Math.min(300, Math.max(30, Number(merged.codexTimeoutSeconds) || 120)),
    maxHistory: Math.min(200, Math.max(10, Number(merged.maxHistory) || 50)),
  }
}

export async function loadSettings(): Promise<Settings> {
  if (!isTauriRuntime) return { ...DEFAULT_SETTINGS }
  const store = await localStore()
  return normalizeSettings(await store.get<Partial<Settings>>('settings'))
}

export async function saveSettings(settings: Settings): Promise<void> {
  if (!isTauriRuntime) return
  const store = await localStore()
  await store.set('settings', normalizeSettings(settings))
}

export async function loadHistory(): Promise<HistoryItem[]> {
  if (!isTauriRuntime) return []
  const store = await localStore()
  return await store.get<HistoryItem[]>('history') ?? []
}

export async function saveHistory(history: HistoryItem[]): Promise<void> {
  if (!isTauriRuntime) return
  const store = await localStore()
  await store.set('history', history)
}
