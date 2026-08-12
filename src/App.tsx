import {
  Clock3,
  History,
  Settings as SettingsIcon,
  Sparkles,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'
import { codexCliTransport, deepSeekTransport, testDeepSeekConnection } from './bridge/tauri'
import { HistoryView } from './components/HistoryView'
import { InputPanel } from './components/InputPanel'
import { ResultPanel } from './components/ResultPanel'
import { SettingsView } from './components/SettingsView'
import { createCodexCliProvider } from './providers/codexCliProvider'
import { createDeepSeekProvider } from './providers/deepseekProvider'
import { CHARACTER_TRIPTYCH_RULES_VERSION } from './prompts/characterTriptych'
import { loadHistory, loadSettings, saveHistory, saveSettings } from './storage/store'
import type {
  AppView,
  HistoryItem,
  OptimizationStage,
  OptimizeResult,
  ProviderAvailability,
  ProviderId,
  Settings,
} from './types'
import { DEFAULT_SETTINGS } from './types'

const INITIAL_CODEX_STATUS: ProviderAvailability = {
  available: false,
  checking: true,
  message: '正在检测 Codex CLI…',
}

const DEV_RESULT_PREVIEW = (
  import.meta.env.DEV
  && new URLSearchParams(window.location.search).get('preview') === 'result'
)

const DEV_SAMPLE_RESULT: OptimizeResult = {
  prompt: 'Three studio photographs of the same 32-year-old East Asian woman arranged side by side on a flat neutral mid-grey studio backdrop, a film character sheet. She is a lean documentary filmmaker with an oval face, observant dark-brown eyes, softly defined cheekbones, and short naturally curled black hair. She wears an olive cotton field jacket over a charcoal crew-neck shirt, straight dark trousers, and worn black leather boots, consistent in all panels. On the left she stands facing the camera in a neutral full-body pose, arms relaxed at her sides. In the middle the same standing pose is seen directly from behind. On the right, a close-up head-and-shoulders portrait holds a calm, perceptive expression. The same real person appears in all three panels, consistent across panels, under soft directional cinematic studio light with gentle natural shadow falloff, living skin texture, and restrained modern photographic color.',
  panels: {
    left: 'Full-body front photograph, straight neutral pose, arms naturally relaxed, complete figure from head to feet.',
    middle: 'The same full-body standing pose seen directly from behind, with identical hair, jacket, trousers, and boots.',
    right: 'Close-up head-and-shoulders portrait, calm perceptive expression, short natural curls and observant dark-brown eyes clearly readable.',
  },
  identityAnchors: [
    'The same real person in all three panels',
    'Short naturally curled black hair',
    'Lean build and calm, perceptive presence',
  ],
  wardrobe: 'Olive cotton field jacket, charcoal crew-neck shirt, straight dark trousers, and worn black leather boots, consistent in all panels.',
  assumptions: [
    '将“短卷发”具体化为自然黑色短卷发。',
    '补全为偏瘦体型与椭圆脸，以匹配纪录片导演的沉静气质。',
    '默认使用中性灰摄影棚背景与柔和单侧灯光。',
    '补全无品牌的黑色旧皮靴，保持实用型造型。',
  ],
  notes: '在 Soul 2.0 中选择 16:9 与 2k；如已有 Soul ID，请同时启用。',
  rawResponse: '',
}

function App() {
  const [view, setView] = useState<AppView>('optimizer')
  const [description, setDescription] = useState(
    DEV_RESULT_PREVIEW
      ? '32 岁女性纪录片导演，短卷发，沉静敏锐，穿橄榄绿工装夹克与深色长裤。'
      : '',
  )
  const [hasReferenceImage, setHasReferenceImage] = useState(DEV_RESULT_PREVIEW)
  const [providerId, setProviderId] = useState<ProviderId>(DEFAULT_SETTINGS.defaultProvider)
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [result, setResult] = useState<OptimizeResult | null>(
    DEV_RESULT_PREVIEW ? DEV_SAMPLE_RESULT : null,
  )
  const [stage, setStage] = useState<OptimizationStage>(
    DEV_RESULT_PREVIEW ? 'completed' : 'idle',
  )
  const [status, setStatus] = useState(DEV_RESULT_PREVIEW ? '开发预览' : '')
  const [error, setError] = useState('')
  const [hydrated, setHydrated] = useState(false)
  const [codexStatus, setCodexStatus] = useState<ProviderAvailability>(INITIAL_CODEX_STATUS)

  const availability = useMemo<Record<ProviderId, ProviderAvailability>>(() => ({
    deepseek: {
      available: Boolean(settings.deepseekApiKey.trim()),
      message: settings.deepseekApiKey.trim() ? 'API Key 已配置' : '需要先配置 API Key',
    },
    'codex-cli': codexStatus,
  }), [codexStatus, settings.deepseekApiKey])

  const refreshCodex = useCallback(async () => {
    setCodexStatus((current) => ({
      ...current,
      checking: true,
      message: '正在检测 Codex CLI…',
    }))
    try {
      setCodexStatus({ ...(await codexCliTransport.status()), checking: false })
    } catch (caught) {
      setCodexStatus({
        available: false,
        checking: false,
        message: caught instanceof Error ? caught.message : String(caught),
      })
    }
  }, [])

  useEffect(() => {
    void Promise.all([loadSettings(), loadHistory()]).then(([loadedSettings, loadedHistory]) => {
      setSettings(loadedSettings)
      setProviderId(loadedSettings.defaultProvider)
      setHistory(loadedHistory)
      setHydrated(true)
    })
    void refreshCodex()
  }, [refreshCodex])

  useEffect(() => {
    if (hydrated) void saveSettings(settings)
  }, [hydrated, settings])

  const handleSettingsChange = (next: Settings) => {
    if (next.defaultProvider !== settings.defaultProvider) {
      setProviderId(next.defaultProvider)
    }
    setSettings(next)
  }

  const optimize = useCallback(async () => {
    if (!description.trim() || stage === 'optimizing') return
    if (!availability[providerId].available) {
      setError(availability[providerId].message)
      return
    }

    setStage('checking')
    setStatus('正在检查优化引擎')
    setError('')
    setResult(null)

    const provider = providerId === 'deepseek'
      ? createDeepSeekProvider({
          apiKey: settings.deepseekApiKey,
          model: settings.deepseekModel,
          transport: deepSeekTransport,
        })
      : createCodexCliProvider({
          timeoutSeconds: settings.codexTimeoutSeconds,
          transport: codexCliTransport,
        })

    try {
      if (!await provider.isAvailable()) {
        throw new Error(providerId === 'deepseek' ? 'DeepSeek API Key 未配置。' : 'Codex CLI 当前不可用。')
      }
      setStage('optimizing')
      setStatus(providerId === 'deepseek' ? 'DeepSeek 正在整理身份与三格构图' : 'Codex 正在整理身份与三格构图')
      const optimized = await provider.optimize({
        characterDescription: description,
        hasReferenceImage,
      })
      setResult(optimized)
      setStage('completed')
      setStatus('优化完成')

      if (settings.saveHistory) {
        const item: HistoryItem = {
          id: crypto.randomUUID(),
          timestamp: Date.now(),
          providerId,
          hasReferenceImage,
          characterDescription: description.trim(),
          rulesVersion: CHARACTER_TRIPTYCH_RULES_VERSION,
          result: optimized,
        }
        const next = [item, ...history].slice(0, settings.maxHistory)
        setHistory(next)
        await saveHistory(next)
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught)
      setError(message.replace(/^Error:\s*/, ''))
      setStage('error')
      setStatus('优化失败')
    }
  }, [
    availability,
    description,
    hasReferenceImage,
    history,
    providerId,
    settings,
    stage,
  ])

  useEffect(() => {
    const handleKeyboard = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault()
        void optimize()
      }
      if ((event.metaKey || event.ctrlKey) && event.key === ',') {
        event.preventDefault()
        setView('settings')
      }
    }
    window.addEventListener('keydown', handleKeyboard)
    return () => window.removeEventListener('keydown', handleKeyboard)
  }, [optimize])

  const clearHistory = async () => {
    if (!history.length) return
    if (!window.confirm('确定清空全部本地历史记录？此操作无法撤销。')) return
    setHistory([])
    await saveHistory([])
  }

  const deleteHistory = async (id: string) => {
    const next = history.filter((item) => item.id !== id)
    setHistory(next)
    await saveHistory(next)
  }

  const openHistory = (item: HistoryItem) => {
    setDescription(item.characterDescription)
    setHasReferenceImage(item.hasReferenceImage)
    setProviderId(item.providerId)
    setResult(item.result)
    setStage('completed')
    setStatus('已打开历史结果')
    setError('')
    setView('optimizer')
  }

  const runDeepSeekTest = async () => {
    const message = await testDeepSeekConnection(settings.deepseekApiKey.trim())
    return message
  }

  return (
    <div className="app-shell">
      <header className="app-header" data-tauri-drag-region>
        <button
          type="button"
          className="brand"
          onClick={() => setView('optimizer')}
          aria-label="回到优化页"
        >
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <span className="brand-copy">
            <strong>三联人像</strong>
            <small>CHARACTER TRIPTYCH</small>
          </span>
        </button>
        <nav aria-label="主导航">
          <button
            type="button"
            className={view === 'optimizer' ? 'active' : ''}
            onClick={() => setView('optimizer')}
          >
            <Sparkles size={15} />优化
          </button>
          <button
            type="button"
            className={view === 'history' ? 'active' : ''}
            onClick={() => setView('history')}
          >
            <History size={15} />历史
            {history.length > 0 && <span>{history.length > 99 ? '99+' : history.length}</span>}
          </button>
          <button
            type="button"
            className={view === 'settings' ? 'active' : ''}
            onClick={() => setView('settings')}
          >
            <SettingsIcon size={15} />设置
          </button>
        </nav>
      </header>

      <main>
        {view === 'optimizer' && (
          <div className="optimizer-view">
            <div className="optimizer-intro">
              <div>
                <span className="eyebrow"><i />HIGGSFIELD SOUL 2.0</span>
                <h2>把人物描述，变成可直接出图的三联 Prompt。</h2>
              </div>
              <p>固定正面全身、背面全身与面部特写，统一同一真人、服装和摄影质感。</p>
            </div>
            <div className="workspace-grid">
              <InputPanel
                description={description}
                onDescription={(value) => {
                  setDescription(value)
                  if (error) setError('')
                }}
                hasReferenceImage={hasReferenceImage}
                onReferenceMode={setHasReferenceImage}
                providerId={providerId}
                onProvider={(value) => {
                  setProviderId(value)
                  setError('')
                }}
                availability={availability}
                stage={stage}
                error={error}
                onOptimize={() => void optimize()}
                onOpenSettings={() => setView('settings')}
              />
              <ResultPanel result={result} stage={stage} status={status} />
            </div>
          </div>
        )}

        {view === 'history' && (
          <HistoryView
            items={history}
            onOpen={openHistory}
            onDelete={(id) => void deleteHistory(id)}
            onClear={() => void clearHistory()}
          />
        )}

        {view === 'settings' && (
          <SettingsView
            settings={settings}
            onChange={handleSettingsChange}
            availability={availability}
            onRefreshCodex={refreshCodex}
            onTestDeepSeek={runDeepSeekTest}
            historyCount={history.length}
            onClearHistory={() => void clearHistory()}
          />
        )}
      </main>

      <footer className="app-footer">
        <span><Clock3 size={13} />规则 v{CHARACTER_TRIPTYCH_RULES_VERSION}</span>
        <span>纯文字处理 · 本地历史 · 不接触图片</span>
      </footer>
    </div>
  )
}

export default App
