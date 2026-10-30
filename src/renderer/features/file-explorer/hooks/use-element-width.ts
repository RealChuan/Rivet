import { useEffect, useRef, useState, type RefObject } from 'react'

/**
 * 监听元素内容宽度。ref 指向的元素可能晚于 hook 挂载才出现（加载态、列表/宫格切换），
 * 所以每次渲染都检查 ref.current，元素变化时重新挂 ResizeObserver。
 */
export function useElementWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0)
  const observedRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const element = ref.current
    if (!element || observedRef.current === element) return
    observedRef.current = element

    const frame = requestAnimationFrame(() => setWidth(element.clientWidth))
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) setWidth(entry.contentRect.width)
    })
    observer.observe(element)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      if (observedRef.current === element) observedRef.current = null
    }
  })

  return width
}
