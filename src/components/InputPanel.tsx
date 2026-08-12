import {
  ArrowRight,
  CheckCircle2,
  ImageOff,
  LoaderCircle,
  ScanFace,
  Settings2,
  Sparkles,
} from 'lucide-react'
import type {
  OptimizationStage,
  ProviderAvailability,
  ProviderId,
} from '../types'
import { PROVIDER_LABELS } from '../types'

interface Props {
  description: string
  onDescription: (value: string) => void
  hasReferenceImage: boolean
  onReferenceMode: (value: boolean) => void
  providerId: ProviderId
  onProvider: (value: ProviderId) => void
  availability: Record<ProviderId, ProviderAvailability>
  stage: OptimizationStage
  error: string
  onOptimize: () => void
  onOpenSettings: () => void
}

const EXAMPLES = [
  '28 岁东亚女性建筑师，冷静利落，短发，穿深灰色工作夹克与宽腿裤',
  '60 岁男性旧书店老板，温和但疲惫，银灰卷发，穿磨旧的棕色灯芯绒西装',
  '年轻女性地下乐队主唱，敏锐叛逆，黑色短发，复古皮衣与银色耳饰',
]

export function InputPanel({
  description,
  onDescription,
  hasReferenceImage,
  onReferenceMode,
  providerId,
  onProvider,
  availability,
  stage,
  error,
  onOptimize,
  onOpenSettings,
}: Props) {
  const busy = stage === 'checking' || stage === 'optimizing'
  const providerStatus = availability[providerId]
  const ready = Boolean(description.trim()) && providerStatus.available && !busy

  return (
    <section className="input-panel card">
      <div className="section-heading">
        <div>
          <span className="step-label">01 · CHARACTER BRIEF</span>
          <h1>写下这个人是谁。</h1>
        </div>
        <span className="single-badge">单条模式</span>
      </div>

      <label className="field-label" htmlFor="character-description">
        人物描述
        <span>{description.length} / 4000</span>
      </label>
      <textarea
        id="character-description"
        className="character-input"
        value={description}
        maxLength={4000}
        onChange={(event) => onDescription(event.target.value)}
        placeholder="年龄、气质、职业、服装、发型、体态、标志性细节……写多少都可以，缺失信息会由 AI 合理补全。"
        spellCheck={false}
      />

      {!description && (
        <div className="example-row" aria-label="描述示例">
          <span>试试</span>
          {EXAMPLES.map((example, index) => (
            <button key={example} type="button" onClick={() => onDescription(example)}>
              示例 {index + 1}
            </button>
          ))}
        </div>
      )}

      <div className="mode-block">
        <div className="field-label">
          身份锚定方式
          <span>不上传图片</span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={hasReferenceImage}
          className={'reference-switch ' + (hasReferenceImage ? 'is-on' : '')}
          onClick={() => onReferenceMode(!hasReferenceImage)}
        >
          <span className="mode-icon">
            {hasReferenceImage ? <ScanFace size={19} /> : <ImageOff size={19} />}
          </span>
          <span className="mode-copy">
            <strong>{hasReferenceImage ? '有参考图，锁定现有人物' : '无参考图，完整生成人物身份'}</strong>
            <small>
              {hasReferenceImage
                ? '提示词会要求三格与稍后在 Higgsfield 上传的人物完全一致'
                : '提示词会完整补足年龄、五官、发型、体态与气质'}
            </small>
          </span>
          <span className="switch-track" aria-hidden="true"><i /></span>
        </button>
        <p className="mode-hint">
          这个开关只改变文字写法。工具不会读取、上传或保存任何图片。
        </p>
      </div>

      <div className="provider-row">
        <label className="provider-select-wrap">
          <span className="field-label">优化引擎</span>
          <select
            value={providerId}
            onChange={(event) => onProvider(event.target.value as ProviderId)}
            aria-label="选择优化引擎"
          >
            <option value="codex-cli" disabled={!availability['codex-cli'].available}>
              {PROVIDER_LABELS['codex-cli']}
            </option>
            <option value="deepseek" disabled={!availability.deepseek.available}>
              {PROVIDER_LABELS.deepseek}
            </option>
          </select>
        </label>
        <div className={'provider-state ' + (providerStatus.available ? 'ready' : 'not-ready')}>
          {providerStatus.checking
            ? <LoaderCircle size={15} className="spin" />
            : providerStatus.available
              ? <CheckCircle2 size={15} />
              : <Settings2 size={15} />}
          <span>{providerStatus.message}</span>
        </div>
      </div>

      {error && <div className="inline-error" role="alert">{error}</div>}

      <div className="submit-row">
        {!providerStatus.available && (
          <button type="button" className="text-button" onClick={onOpenSettings}>
            前往设置 <ArrowRight size={14} />
          </button>
        )}
        <span className="shortcut">⌘ / Ctrl + Enter</span>
        <button
          type="button"
          className="primary-button"
          disabled={!ready}
          onClick={onOptimize}
        >
          {busy ? <LoaderCircle size={18} className="spin" /> : <Sparkles size={18} />}
          {busy ? '正在编排三联…' : '开始优化'}
        </button>
      </div>
    </section>
  )
}
