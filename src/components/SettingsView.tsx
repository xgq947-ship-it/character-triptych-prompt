import {
  CheckCircle2,
  Eye,
  EyeOff,
  HardDrive,
  KeyRound,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  TerminalSquare,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'
import type { ProviderAvailability, ProviderId, Settings } from '../types'
import { PROVIDER_LABELS } from '../types'

interface Props {
  settings: Settings
  onChange: (settings: Settings) => void
  availability: Record<ProviderId, ProviderAvailability>
  onRefreshCodex: () => Promise<void>
  onTestDeepSeek: () => Promise<string>
  historyCount: number
  onClearHistory: () => void
}

export function SettingsView({
  settings,
  onChange,
  availability,
  onRefreshCodex,
  onTestDeepSeek,
  historyCount,
  onClearHistory,
}: Props) {
  const [showKey, setShowKey] = useState(false)
  const [testingKey, setTestingKey] = useState(false)
  const [testMessage, setTestMessage] = useState('')

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    onChange({ ...settings, [key]: value })
  }

  const testConnection = async () => {
    setTestingKey(true)
    setTestMessage('')
    try {
      setTestMessage(await onTestDeepSeek())
    } catch (error) {
      setTestMessage(error instanceof Error ? error.message : String(error))
    } finally {
      setTestingKey(false)
    }
  }

  return (
    <section className="page-view settings-view">
      <div className="page-heading">
        <div>
          <span className="step-label">LOCAL PREFERENCES</span>
          <h1>设置</h1>
          <p>选择默认引擎、管理本地凭据与历史记录。</p>
        </div>
        <span className="autosave-badge"><CheckCircle2 size={14} />自动保存</span>
      </div>

      <div className="settings-layout">
        <div className="settings-main-column">
          <section className="settings-card card">
            <div className="settings-title">
              <div className="settings-icon"><TerminalSquare size={19} /></div>
              <div><h2>默认优化引擎</h2><p>两个引擎使用同一套 LIRA 三联规则。</p></div>
            </div>
            <div className="provider-choice-grid">
              {(['codex-cli', 'deepseek'] as ProviderId[]).map((id) => {
                const state = availability[id]
                const active = settings.defaultProvider === id
                return (
                  <button
                    type="button"
                    key={id}
                    disabled={!state.available}
                    className={'provider-choice ' + (active ? 'active' : '')}
                    onClick={() => update('defaultProvider', id)}
                  >
                    <span className={'status-dot ' + (state.available ? 'online' : '')} />
                    <strong>{PROVIDER_LABELS[id]}</strong>
                    <small>{state.message}</small>
                    {active && <CheckCircle2 size={17} />}
                  </button>
                )
              })}
            </div>
          </section>

          <section className="settings-card card">
            <div className="settings-title">
              <div className="settings-icon amber"><KeyRound size={19} /></div>
              <div><h2>DeepSeek API</h2><p>适合没有本地 Codex CLI 的设备。</p></div>
            </div>
            <label className="settings-field">
              <span>API Key</span>
              <div className="secret-input">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={settings.deepseekApiKey}
                  autoComplete="off"
                  placeholder="sk-••••••••••••••••"
                  onChange={(event) => {
                    update('deepseekApiKey', event.target.value)
                    if (testMessage) setTestMessage('')
                  }}
                />
                <button type="button" onClick={() => setShowKey(!showKey)} title="显示或隐藏 Key">
                  {showKey ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </label>
            <div className="settings-inline">
              <label className="settings-field">
                <span>模型</span>
                <select
                  value={settings.deepseekModel}
                  onChange={(event) => update(
                    'deepseekModel',
                    event.target.value as Settings['deepseekModel'],
                  )}
                >
                  <option value="deepseek-v4-flash">V4 Flash · 快速经济</option>
                  <option value="deepseek-v4-pro">V4 Pro · 更强推理</option>
                </select>
              </label>
              <button
                type="button"
                className="secondary-button"
                disabled={!settings.deepseekApiKey.trim() || testingKey}
                onClick={() => void testConnection()}
              >
                {testingKey ? <LoaderCircle size={16} className="spin" /> : <RefreshCw size={16} />}
                测试连接
              </button>
            </div>
            {testMessage && <div className="test-message">{testMessage}</div>}
            <div className="privacy-line"><ShieldCheck size={15} />Key 仅写入本机应用 Store，不进入日志。</div>
          </section>

          <section className="settings-card card">
            <div className="settings-title">
              <div className="settings-icon green"><TerminalSquare size={19} /></div>
              <div><h2>Codex CLI</h2><p>复用本机已有的 Codex 登录状态。</p></div>
            </div>
            <div className="codex-detection">
              <div>
                <span className={'status-dot ' + (availability['codex-cli'].available ? 'online' : '')} />
                <strong>{availability['codex-cli'].available ? '已检测到 Codex CLI' : '未检测到 Codex CLI'}</strong>
                <small>{availability['codex-cli'].version || availability['codex-cli'].message}</small>
              </div>
              <button
                type="button"
                className="icon-text-button"
                disabled={availability['codex-cli'].checking}
                onClick={() => void onRefreshCodex()}
              >
                <RefreshCw
                  size={15}
                  className={availability['codex-cli'].checking ? 'spin' : ''}
                />
                重新检测
              </button>
            </div>
            <label className="settings-field timeout-field">
              <span>最长等待时间 <b>{settings.codexTimeoutSeconds} 秒</b></span>
              <input
                type="range"
                min="30"
                max="300"
                step="30"
                value={settings.codexTimeoutSeconds}
                onChange={(event) => update('codexTimeoutSeconds', Number(event.target.value))}
              />
            </label>
            <div className="privacy-line"><ShieldCheck size={15} />人物描述通过 stdin 传入，绝不拼接到 shell 命令。</div>
          </section>
        </div>

        <aside className="settings-side-column">
          <section className="settings-card card">
            <div className="settings-title compact">
              <div className="settings-icon"><HardDrive size={18} /></div>
              <div><h2>本地历史</h2><p>{historyCount} 条记录</p></div>
            </div>
            <label className="settings-toggle">
              <span><strong>保存优化记录</strong><small>方便稍后重新复制</small></span>
              <button
                type="button"
                role="switch"
                aria-checked={settings.saveHistory}
                className={settings.saveHistory ? 'is-on' : ''}
                onClick={() => update('saveHistory', !settings.saveHistory)}
              ><i /></button>
            </label>
            <label className="settings-field">
              <span>最多保留</span>
              <select
                value={settings.maxHistory}
                disabled={!settings.saveHistory}
                onChange={(event) => update('maxHistory', Number(event.target.value))}
              >
                <option value={25}>25 条</option>
                <option value={50}>50 条</option>
                <option value={100}>100 条</option>
                <option value={200}>200 条</option>
              </select>
            </label>
            <button
              type="button"
              className="danger-button"
              disabled={!historyCount}
              onClick={onClearHistory}
            >
              <Trash2 size={15} />清空本地历史
            </button>
          </section>

          <section className="privacy-card">
            <ShieldCheck size={20} />
            <h3>隐私边界</h3>
            <p>本工具只处理文字。没有图片上传、识图、账号系统或云端历史。</p>
          </section>
        </aside>
      </div>
    </section>
  )
}
