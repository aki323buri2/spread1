import { useCallback, useEffect, useRef, useState } from 'react'
import type { Grid } from 'react-virtualized'

interface ScrollState {
  isScrolling: boolean
  direction: 'left' | 'right' | 'up' | 'down' | null
  speed: number
}

interface ScrollZone {
  left: number
  right: number
  top: number
  bottom: number
  threshold: number
}

interface DebugInfo {
  mousePosition: { x: number; y: number } | null
  containerSize: { width: number; height: number } | null
  scrollSpeed: { x: number; y: number }
}

const SCROLL_ZONE_THRESHOLD = 50
const BASE_SCROLL_SPEED = 2
const MAX_SCROLL_SPEED = 30

interface UseSpreadsheetScrollProps {
  gridRef: React.RefObject<Grid | null>
  rowCount: number
  columnCount: number
  defaultRowHeight?: number
  defaultColumnWidth?: number
  isDragging: boolean
  onScroll?: (scrollLeft: number, scrollTop: number) => void
  onMouseMove?: (mousePosition: { x: number; y: number } | null) => void
}

export function useSpreadsheetScroll({
  gridRef,
  rowCount,
  columnCount,
  defaultRowHeight = 24,
  defaultColumnWidth = 100,
  isDragging,
  onScroll,
  onMouseMove,
}: UseSpreadsheetScrollProps) {
  const [scrollState, setScrollState] = useState<ScrollState>({
    isScrolling: false,
    direction: null,
    speed: 0
  })
  const [debugInfo, setDebugInfo] = useState<DebugInfo>({
    mousePosition: null,
    containerSize: null,
    scrollSpeed: { x: 0, y: 0 }
  })
  const rafRef = useRef<number | null>(null)
  const lastMousePositionRef = useRef<{ x: number; y: number; rect: DOMRect } | null>(null)

  // スクロールゾーンの計算
  const calculateScrollZone = useCallback((rect: DOMRect): ScrollZone => {
    return {
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
      threshold: SCROLL_ZONE_THRESHOLD
    }
  }, [])

  // スクロール方向と速度の計算
  const calculateScrollDirection = useCallback((mouseX: number, mouseY: number, zone: ScrollZone): ScrollState => {
    let direction: 'left' | 'right' | 'up' | 'down' | null = null
    let speed = 0

    // 水平方向のスクロール
    if (mouseX < zone.left + zone.threshold) {
      direction = 'left'
      speed = Math.min(MAX_SCROLL_SPEED, BASE_SCROLL_SPEED + (zone.left + zone.threshold - mouseX) / 10)
    } else if (mouseX > zone.right - zone.threshold) {
      direction = 'right'
      speed = Math.min(MAX_SCROLL_SPEED, BASE_SCROLL_SPEED + (mouseX - (zone.right - zone.threshold)) / 10)
    }

    // 垂直方向のスクロール
    if (mouseY < zone.top + zone.threshold) {
      direction = 'up'
      speed = Math.min(MAX_SCROLL_SPEED, BASE_SCROLL_SPEED + (zone.top + zone.threshold - mouseY) / 10)
    } else if (mouseY > zone.bottom - zone.threshold) {
      direction = 'down'
      speed = Math.min(MAX_SCROLL_SPEED, BASE_SCROLL_SPEED + (mouseY - (zone.bottom - zone.threshold)) / 10)
    }

    return {
      isScrolling: direction !== null,
      direction,
      speed
    }
  }, [])

  const handleMouseMove = useCallback((e: globalThis.MouseEvent) => {
    if (!isDragging || !gridRef.current) return

    const grid = gridRef.current
    const container = (grid as unknown as { _scrollingContainer: HTMLElement })._scrollingContainer
    const mainGridRect = container.getBoundingClientRect()
    
    // マウス位置の相対座標を計算
    const mouseX = e.clientX - mainGridRect.left
    const mouseY = e.clientY - mainGridRect.top

    // スクロールゾーンの計算
    const scrollZone = calculateScrollZone(mainGridRect)
    
    // スクロール状態の更新
    const newScrollState = calculateScrollDirection(mouseX, mouseY, scrollZone)
    setScrollState(newScrollState)

    // マウス位置の状態を更新
    const newMousePosition = {
      x: mouseX,
      y: mouseY,
      rect: mainGridRect
    }
    lastMousePositionRef.current = newMousePosition

    // マウス位置の更新を通知
    onMouseMove?.(newMousePosition)
  }, [isDragging, calculateScrollZone, calculateScrollDirection, onMouseMove])

  const startScrolling = useCallback(() => {
    if (!lastMousePositionRef.current || !gridRef.current) return

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
    }

    const scroll = () => {
      if (!isDragging || !gridRef.current || !lastMousePositionRef.current) return

      const { rect } = lastMousePositionRef.current
      const container = (gridRef.current as unknown as { _scrollingContainer: HTMLElement })._scrollingContainer
      const grid = gridRef.current

      // スクロール状態に基づいてスクロールを実行
      const { direction, speed } = scrollState
      let scrollSpeedX = 0
      let scrollSpeedY = 0

      switch (direction) {
        case 'left':
          scrollSpeedX = -speed
          break
        case 'right':
          scrollSpeedX = speed
          break
        case 'up':
          scrollSpeedY = -speed
          break
        case 'down':
          scrollSpeedY = speed
          break
      }

      // スクロール位置の更新
      const currentScrollLeft = container.scrollLeft
      const currentScrollTop = container.scrollTop
      const maxScrollLeft = (columnCount * defaultColumnWidth) - rect.width
      const maxScrollTop = (rowCount * defaultRowHeight) - rect.height

      const newScrollLeft = Math.max(0, Math.min(maxScrollLeft, currentScrollLeft + scrollSpeedX))
      const newScrollTop = Math.max(0, Math.min(maxScrollTop, currentScrollTop + scrollSpeedY))

      if (newScrollLeft !== currentScrollLeft || newScrollTop !== currentScrollTop) {
        // スクロール位置の更新と通知を同期して実行
        grid.scrollToPosition({ scrollLeft: newScrollLeft, scrollTop: newScrollTop })
        
        // スクロール位置の変更を即座に通知
        onScroll?.(newScrollLeft, newScrollTop)
      }

      // スクロールが必要な場合は次のフレームをスケジュール
      if (direction !== null) {
        rafRef.current = requestAnimationFrame(scroll)
      }
    }

    rafRef.current = requestAnimationFrame(scroll)
  }, [columnCount, rowCount, defaultColumnWidth, defaultRowHeight, scrollState, isDragging, onScroll])

  // スクロール状態が変更されたときにスクロールを開始/停止
  useEffect(() => {
    if (scrollState.isScrolling) {
      startScrolling()
    } else if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
    }
  }, [scrollState.isScrolling, startScrolling])

  const stopScrolling = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      if (gridRef.current) {
        gridRef.current.recomputeGridSize()
      }
    }
  }, [])

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [handleMouseMove])

  return {
    handleMouseMove,
    stopScrolling,
    debugInfo
  }
} 