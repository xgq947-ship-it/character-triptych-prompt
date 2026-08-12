import {
  AlertTriangle,
  Check,
  ChevronDown,
  Clipboard,
  Copy,
  LoaderCircle,
  Sparkles,
} from 'lucide-react'
import { useClipboard } from '../hooks/useClipboard'
import type { OptimizationStage, OptimizeResult } from '../types'

interface Props {
  result: OptimizeResult | null
  stage: OptimizationStage
  status: string
}

const PANEL_META = [
  { key: 'left' as const, index: '01', label: '左格', title: '正面全身' },
  { key: 'middle' as const, index: '02', label: '中格', title: '背面全身' },
  { key: 'right' as const, index: '03', label: '右格', title: '面部特写' },
]

function CopyControl({
  id,
  value,
  copiedKey,
  onCopy,
  label = '复制',
}: {
  id: string
  value: string
  copiedKey: string
  onCopy: (key: string, text: string) => Promise<void>
  label?: string
}) {
  const copied = copiedKey === id
  return (
    <button
      type="button"
      className={'copy-button ' + (copied ? 'copied' : '')}
      disabled={!value}
      onClick={() => void onCopy(id, value)}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {copied ? '已复制' : label}
    </button>
  )
}

export function ResultPanel({ result, stage, status }: Props) {
  const { copiedKey, copy } = useClipboard()
  const loading = stage === 'checking' || stage === 'optimizing'

  if (loading) {
    return (
      <section className="result-panel card result-loading" aria-live="polite">
        <div className="loading-orbit"><LoaderCircle size={28} className="spin" /></div>
        <span className="step-label">SOUL 2.0 · COMPOSING</span>
        <h2>{status || '正在编排三联结构'}</h2>
        <p>统一身份、服装与摄影质感，再分别组织正面、背面和特写。</p>
        <div className="skeleton-triptych">
          <i /><i /><i />
        </div>
      </section>
    )
  }

  if (!result) {
    return (
      <section className="result-panel card result-empty">
        <div className="empty-visual" aria-hidden="true">
          <div className="empty-panel"><span className="full-person front" /></div>
          <div className="empty-panel"><span className="full-person back" /></div>
          <div className="empty-panel close"><span className="close-person" /></div>
        </div>
        <span className="step-label">02 · TRIPTYCH OUTPUT</span>
        <h2>一条描述，整理成三格。</h2>
        <p>完整 Prompt、分格内容、身份锚点和 AI 补全假设都会集中显示在这里。</p>
        <div className="empty-specs">
          <span>正面全身</span><i />
          <span>背面全身</span><i />
          <span>面部特写</span>
        </div>
      </section>
    )
  }

  return (
    <section className="result-panel result-complete" aria-live="polite">
      {result.parseWarning && (
        <div className="parse-warning">
          <AlertTriangle size={18} />
          <div><strong>输出结构需要检查</strong><span>{result.parseWarning}</span></div>
        </div>
      )}

      <div className="result-card card">
        <div className="result-heading">
          <div>
            <span className="step-label">READY · PASTE INTO SOUL 2.0</span>
            <h2>完整三联 Prompt</h2>
          </div>
          <CopyControl
            id="full"
            value={result.prompt}
            copiedKey={copiedKey}
            onCopy={copy}
            label="复制全文"
          />
        </div>
        {result.prompt
          ? <div className="prompt-output">{result.prompt}</div>
          : <div className="prompt-missing">未能从返回内容中读取完整 Prompt，请查看下方原始输出。</div>}
      </div>

      <div className="panel-grid">
        {PANEL_META.map((panel) => (
          <article className={'panel-card panel-' + panel.key} key={panel.key}>
            <div className="panel-head">
              <span className="panel-index">{panel.index}</span>
              <div><small>{panel.label}</small><strong>{panel.title}</strong></div>
              <CopyControl
                id={panel.key}
                value={result.panels[panel.key]}
                copiedKey={copiedKey}
                onCopy={copy}
              />
            </div>
            <p>{result.panels[panel.key] || '这一格没有解析到内容。'}</p>
          </article>
        ))}
      </div>

      <div className="result-details card">
        <div className="detail-section wardrobe-section">
          <span className="detail-kicker">WARDROBE LOCK</span>
          <h3>跨格服装一致性</h3>
          <p>{result.wardrobe || '未返回服装描述。'}</p>
        </div>
        <div className="detail-section">
          <span className="detail-kicker">IDENTITY ANCHORS</span>
          <h3>身份锚点</h3>
          <ul className="anchor-list">
            {result.identityAnchors.length
              ? result.identityAnchors.map((item) => <li key={item}>{item}</li>)
              : <li>未返回身份锚点。</li>}
          </ul>
        </div>
        <div className="detail-section assumptions-section">
          <span className="detail-kicker">ASSUMPTIONS</span>
          <h3>AI 做出的合理补全</h3>
          <ul className="assumption-list">
            {result.assumptions.length
              ? result.assumptions.map((item) => <li key={item}>{item}</li>)
              : <li>没有额外假设。</li>}
          </ul>
        </div>
        {result.notes && (
          <div className="result-note"><Sparkles size={15} /><span>{result.notes}</span></div>
        )}
      </div>

      {result.parseWarning && (
        <details className="raw-output card">
          <summary><span><Clipboard size={16} />原始输出</span><ChevronDown size={16} /></summary>
          <div>
            <pre>{result.rawResponse}</pre>
            <CopyControl
              id="raw"
              value={result.rawResponse}
              copiedKey={copiedKey}
              onCopy={copy}
              label="复制原文"
            />
          </div>
        </details>
      )}
    </section>
  )
}
