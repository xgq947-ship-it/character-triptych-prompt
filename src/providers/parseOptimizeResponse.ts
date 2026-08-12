import type { OptimizeResult } from '../types'

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
}

export function extractJsonText(rawResponse: string): string {
  const trimmed = rawResponse.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  if (fenced?.[1]) return fenced[1].trim()

  const firstBrace = trimmed.indexOf('{')
  const lastBrace = trimmed.lastIndexOf('}')
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1)
  }
  return trimmed
}

export function parseOptimizeResponse(rawResponse: string): OptimizeResult {
  const fallback: OptimizeResult = {
    prompt: '',
    panels: { left: '', middle: '', right: '' },
    identityAnchors: [],
    wardrobe: '',
    assumptions: [],
    notes: '',
    rawResponse,
  }

  let decoded: unknown
  try {
    decoded = JSON.parse(extractJsonText(rawResponse))
  } catch {
    return {
      ...fallback,
      parseWarning: 'AI 返回内容不是有效 JSON。你仍可在“原始输出”中查看并复制内容。',
    }
  }

  if (!isRecord(decoded)) {
    return {
      ...fallback,
      parseWarning: 'AI 返回的 JSON 顶层不是对象。',
    }
  }

  const panels = isRecord(decoded.panels) ? decoded.panels : {}
  const result: OptimizeResult = {
    prompt: asString(decoded.prompt),
    panels: {
      left: asString(panels.left),
      middle: asString(panels.middle),
      right: asString(panels.right),
    },
    identityAnchors: asStringArray(decoded.identityAnchors),
    wardrobe: asString(decoded.wardrobe),
    assumptions: asStringArray(decoded.assumptions),
    notes: asString(decoded.notes),
    rawResponse,
  }

  const missing: string[] = []
  if (!result.prompt) missing.push('prompt')
  if (!result.panels.left) missing.push('panels.left')
  if (!result.panels.middle) missing.push('panels.middle')
  if (!result.panels.right) missing.push('panels.right')
  if (!result.identityAnchors.length) missing.push('identityAnchors')
  if (!result.wardrobe) missing.push('wardrobe')
  if (missing.length) {
    result.parseWarning = `返回结果缺少字段：${missing.join('、')}。已保留原始输出便于排查。`
  }

  return result
}
