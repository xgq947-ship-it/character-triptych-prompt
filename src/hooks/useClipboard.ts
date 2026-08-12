import { useCallback, useEffect, useRef, useState } from 'react'

async function writeClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    return
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const copied = document.execCommand('copy')
    textarea.remove()
    if (!copied) throw new Error('复制失败')
  }
}

export function useClipboard() {
  const [copiedKey, setCopiedKey] = useState('')
  const timeoutRef = useRef<number | null>(null)

  useEffect(() => () => {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current)
  }, [])

  const copy = useCallback(async (key: string, text: string) => {
    if (!text) return
    await writeClipboard(text)
    setCopiedKey(key)
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current)
    timeoutRef.current = window.setTimeout(() => setCopiedKey(''), 1600)
  }, [])

  return { copiedKey, copy }
}
