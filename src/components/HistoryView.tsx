import {
  ArrowUpRight,
  Check,
  Clock3,
  Copy,
  Search,
  Trash2,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useClipboard } from '../hooks/useClipboard'
import type { HistoryItem } from '../types'
import { PROVIDER_LABELS } from '../types'

interface Props {
  items: HistoryItem[]
  onOpen: (item: HistoryItem) => void
  onDelete: (id: string) => void
  onClear: () => void
}

function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp)
}

export function HistoryView({ items, onOpen, onDelete, onClear }: Props) {
  const [query, setQuery] = useState('')
  const { copiedKey, copy } = useClipboard()
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return items
    return items.filter((item) => (
      item.characterDescription.toLowerCase().includes(normalized)
      || item.result.prompt.toLowerCase().includes(normalized)
    ))
  }, [items, query])

  return (
    <section className="page-view history-view">
      <div className="page-heading">
        <div>
          <span className="step-label">LOCAL ARCHIVE</span>
          <h1>历史记录</h1>
          <p>所有内容只保存在这台设备上，可随时重新打开或复制。</p>
        </div>
        {items.length > 0 && (
          <button type="button" className="danger-ghost" onClick={onClear}>
            <Trash2 size={15} />清空全部
          </button>
        )}
      </div>

      {items.length > 0 && (
        <label className="history-search">
          <Search size={17} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索人物描述或 Prompt"
          />
          <span>{filtered.length} 条</span>
        </label>
      )}

      {!items.length ? (
        <div className="empty-page card">
          <Clock3 size={28} />
          <h2>还没有历史记录</h2>
          <p>完成第一条人物三联优化后，它会出现在这里。</p>
        </div>
      ) : !filtered.length ? (
        <div className="empty-page card">
          <Search size={28} />
          <h2>没有匹配结果</h2>
          <p>换一个关键词试试。</p>
        </div>
      ) : (
        <div className="history-list">
          {filtered.map((item, index) => {
            const copyValue = item.result.prompt || item.result.rawResponse
            return (
              <article className="history-item card" key={item.id}>
                <div className="history-number">{String(index + 1).padStart(2, '0')}</div>
                <div className="history-content">
                  <div className="history-meta">
                    <span>{formatTime(item.timestamp)}</span>
                    <i />
                    <span>{PROVIDER_LABELS[item.providerId]}</span>
                    <i />
                    <span>{item.hasReferenceImage ? '参考图锚定' : '完整身份'}</span>
                    <i />
                    <span>规则 v{item.rulesVersion}</span>
                  </div>
                  <h2>{item.characterDescription}</h2>
                  <p>{copyValue}</p>
                </div>
                <div className="history-actions">
                  <button
                    type="button"
                    title="复制完整 Prompt"
                    onClick={() => void copy(item.id, copyValue)}
                  >
                    {copiedKey === item.id ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                  <button type="button" title="重新打开" onClick={() => onOpen(item)}>
                    <ArrowUpRight size={16} />
                  </button>
                  <button
                    type="button"
                    className="delete"
                    title="删除"
                    onClick={() => onDelete(item.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
