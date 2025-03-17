import { useState, useCallback, useEffect, useRef } from 'react'
import type { Grid } from 'react-virtualized'

const ROW_HEIGHT = 24
const COLUMN_WIDTH = 100
const MOVE_INTERVAL = 50 // ミリ秒単位での移動間隔
const HEADER_HEIGHT = 24 // Assuming a default HEADER_HEIGHT

export interface CellPosition {
  row: number
  col: number
}

export interface CellRange {
  start: CellPosition
  end: CellPosition
}

interface DebugInfo {
  mousePosition: { x: number; y: number } | null
  containerSize: { width: number; height: number } | null
  scrollSpeed: { x: number; y: number }
}

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
  threshold: number  // スクロールゾーンの幅
}

const SCROLL_ZONE_THRESHOLD = 50  // スクロールゾーンの幅（ピクセル）
const BASE_SCROLL_SPEED = 2
const MAX_SCROLL_SPEED = 30

interface UseSpreadsheetSelectionProps {
  rowCount: number
  columnCount: number
  gridRef: React.RefObject<Grid | null>
  defaultRowHeight?: number
  defaultColumnWidth?: number
  headerHeight?: number
  headerWidth?: number
  onSelectionChange?: (range: CellRange | null) => void
  onActivePositionChange?: (position: CellPosition | null) => void
  onCellClick?: (position: CellPosition) => void
  onCellDoubleClick?: (position: CellPosition) => void
  onCellContextMenu?: (position: CellPosition, event: React.MouseEvent) => void
}

export function useSpreadsheetSelection({
  rowCount,
  columnCount,
  gridRef,
  defaultRowHeight = 24,
  defaultColumnWidth = 100,
  headerHeight = 24,
  headerWidth = 100,
  onSelectionChange,
  onActivePositionChange,
  onCellClick,
  onCellDoubleClick,
  onCellContextMenu,
}: UseSpreadsheetSelectionProps) {
  const [selectedCell, setSelectedCell] = useState<CellPosition | null>(null)
  const [selectionRange, setSelectionRange] = useState<CellRange | null>(null)
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
  const isDraggingRef = useRef(false)
  const lastMousePositionRef = useRef<{ x: number; y: number; rect: DOMRect } | null>(null)
  const headerDragTypeRef = useRef<'row' | 'column' | null>(null)
  const isHeaderDragRef = useRef(false)  // ヘッダーからのドラッグかどうかを追跡

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

  const moveCell = useCallback((key: string, ctrlKey: boolean, shiftKey: boolean) => {
    if (!selectedCell) return

    let newRow = selectedCell.row
    let newCol = selectedCell.col

    switch (key) {
      case 'ArrowUp':
        newRow = Math.max(0, selectedCell.row - 1)
        break
      case 'ArrowDown':
        newRow = Math.min(rowCount - 1, selectedCell.row + 1)
        break
      case 'ArrowLeft':
        newCol = Math.max(0, selectedCell.col - 1)
        break
      case 'ArrowRight':
        newCol = Math.min(columnCount - 1, selectedCell.col + 1)
        break
      case 'Home':
        if (ctrlKey) {
          newRow = 0  // 上端へ移動
          newCol = 0  // 左端へ移動
        } else {
          newCol = 0  // 左端へ移動
        }
        break
      case 'End':
        if (ctrlKey) {
          newRow = rowCount - 1  // 下端へ移動
          newCol = columnCount - 1  // 右端へ移動
        } else {
          newCol = columnCount - 1  // 右端へ移動
        }
        break
    }

    if (newRow !== selectedCell.row || newCol !== selectedCell.col) {
      rafRef.current = requestAnimationFrame(() => {
        if (shiftKey && selectionRange) {
          // Shiftキーが押されている場合は選択範囲を拡張
          setSelectionRange({
            start: selectionRange.start,
            end: { row: newRow, col: newCol }
          })
          setSelectedCell({ row: newRow, col: newCol })
        } else {
          // 通常の移動
          setSelectedCell({ row: newRow, col: newCol })
          setSelectionRange({
            start: { row: newRow, col: newCol },
            end: { row: newRow, col: newCol }
          })
        }
        gridRef.current?.scrollToCell({ rowIndex: newRow, columnIndex: newCol })
      })
    }
  }, [selectedCell, selectionRange, rowCount, columnCount, gridRef])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return
    e.preventDefault() // デフォルトのスクロール動作を防ぐ
    moveCell(e.key, e.ctrlKey, e.shiftKey)
  }, [moveCell])

  const handleMouseDown = useCallback((row: number, col: number, shiftKey: boolean) => {
    // ヘッダードラッグ中は通常セルのマウスダウンを無視
    if (isHeaderDragRef.current) return

    isDraggingRef.current = true
    if (shiftKey && selectedCell) {
      // Shiftキーが押されている場合は選択範囲を拡張
      setSelectionRange({
        start: selectedCell,
        end: { row, col }
      })
    } else {
      // 通常のマウスダウン
      setSelectedCell({ row, col })
      setSelectionRange({
        start: { row, col },
        end: { row, col }
      })
    }

    // 選択されたセルが完全に表示されるようにスクロール
    if (gridRef.current) {
      const grid = gridRef.current
      const container = (grid as unknown as { _scrollingContainer: HTMLElement })._scrollingContainer
      const currentScrollTop = container.scrollTop
      const currentScrollLeft = container.scrollLeft
      const cellTop = row * ROW_HEIGHT
      const cellBottom = (row + 1) * ROW_HEIGHT
      const cellLeft = col * COLUMN_WIDTH
      const cellRight = (col + 1) * COLUMN_WIDTH
      const viewportHeight = container.clientHeight
      const viewportWidth = container.clientWidth
      const headerHeightOffset = HEADER_HEIGHT
      const headerWidthOffset = COLUMN_WIDTH

      let newScrollTop = currentScrollTop
      let newScrollLeft = currentScrollLeft

      // 縦方向のスクロール処理
      if (cellTop < currentScrollTop + headerHeightOffset) {
        // セルの上端がヘッダーの直下に来るようにスクロール
        newScrollTop = cellTop
      } else if (cellBottom > currentScrollTop + viewportHeight) {
        // セルの下端が表示領域の下端に来るようにスクロール
        newScrollTop = cellBottom - viewportHeight
      }

      // 横方向のスクロール処理
      if (cellLeft < currentScrollLeft + headerWidthOffset) {
        // セルの左端が行ヘッダーの直後に来るようにスクロール
        newScrollLeft = cellLeft
      } else if (cellRight > currentScrollLeft + viewportWidth) {
        // セルの右端が表示領域の右端に来るようにスクロール
        newScrollLeft = cellRight - viewportWidth
      }

      // スクロール位置が変更された場合のみスクロールを実行
      if (newScrollTop !== currentScrollTop || newScrollLeft !== currentScrollLeft) {
        grid.scrollToPosition({ scrollLeft: newScrollLeft, scrollTop: newScrollTop })
      }
    }
  }, [selectedCell])

  const handleHeaderMouseDown = useCallback((index: number, isRow: boolean, shiftKey: boolean) => {
    isDraggingRef.current = true
    headerDragTypeRef.current = isRow ? 'row' : 'column'
    isHeaderDragRef.current = true  // ヘッダーからのドラッグを記録

    if (isRow) {
      // 行ヘッダーのクリック
      if (shiftKey && selectionRange) {
        // Shiftキーが押されている場合は現在の選択範囲から拡張
        setSelectionRange({
          start: selectionRange.start,
          end: { 
            row: index,
            col: columnCount - 1
          }
        })
      } else {
        // 行全体を選択
        setSelectedCell({ row: index, col: 0 })
        setSelectionRange({
          start: { row: index, col: 0 },
          end: { row: index, col: columnCount - 1 }
        })
      }

      // 選択された行が完全に表示されるようにスクロール
      if (gridRef.current) {
        const grid = gridRef.current
        const container = (grid as unknown as { _scrollingContainer: HTMLElement })._scrollingContainer
        const currentScrollTop = container.scrollTop
        const currentScrollLeft = container.scrollLeft
        const rowTop = index * ROW_HEIGHT
        const rowBottom = (index + 1) * ROW_HEIGHT
        const viewportHeight = container.clientHeight
        const headerOffset = HEADER_HEIGHT

        let newScrollTop = currentScrollTop
        // 行が部分的にヘッダーに隠れている場合
        if (rowTop < currentScrollTop + headerOffset) {
          // 行の上端がヘッダーの直下に来るようにスクロール
          newScrollTop = rowTop - headerOffset
        }
        // 行が下端で切れている場合
        else if (rowBottom > currentScrollTop + viewportHeight) {
          // 行の下端が表示領域の下端に来るようにスクロール
          newScrollTop = rowBottom - viewportHeight
        }

        if (newScrollTop !== currentScrollTop) {
          grid.scrollToPosition({ scrollLeft: currentScrollLeft, scrollTop: newScrollTop })
        }
      }
    } else {
      // 列ヘッダーのクリック
      if (shiftKey && selectionRange) {
        // Shiftキーが押されている場合は現在の選択範囲から拡張
        setSelectionRange({
          start: selectionRange.start,
          end: { 
            row: rowCount - 1,
            col: index
          }
        })
      } else {
        // 列全体を選択
        setSelectedCell({ row: 0, col: index })
        setSelectionRange({
          start: { row: 0, col: index },
          end: { row: rowCount - 1, col: index }
        })
      }

      // 選択された列が完全に表示されるようにスクロール（水平方向）
      if (gridRef.current) {
        const grid = gridRef.current
        const container = (grid as unknown as { _scrollingContainer: HTMLElement })._scrollingContainer
        const currentScrollLeft = container.scrollLeft
        const currentScrollTop = container.scrollTop
        const colLeft = index * COLUMN_WIDTH
        const colRight = (index + 1) * COLUMN_WIDTH
        const viewportWidth = container.clientWidth
        const headerOffset = COLUMN_WIDTH  // 行ヘッダーの幅

        let newScrollLeft = currentScrollLeft
        // 列が部分的に行ヘッダーに隠れている場合
        if (colLeft < currentScrollLeft + headerOffset) {
          // 列の左端が行ヘッダーの直後に来るようにスクロール
          newScrollLeft = colLeft - headerOffset
        }
        // 列が右端で切れている場合
        else if (colRight > currentScrollLeft + viewportWidth) {
          // 列の右端が表示領域の右端に来るようにスクロール
          newScrollLeft = colRight - viewportWidth
        }

        if (newScrollLeft !== currentScrollLeft) {
          grid.scrollToPosition({ scrollLeft: newScrollLeft, scrollTop: currentScrollTop })
        }
      }
    }
  }, [selectionRange, rowCount, columnCount])

  const handleCornerHeaderClick = useCallback(() => {
    // 左上のヘッダーをクリックした場合は全セルを選択
    setSelectedCell({ row: 0, col: 0 })
    setSelectionRange({
      start: { row: 0, col: 0 },
      end: { row: rowCount - 1, col: columnCount - 1 }
    })
  }, [rowCount, columnCount])

  const handleMouseMove = useCallback((e: globalThis.MouseEvent) => {
    if (!isDraggingRef.current || !gridRef.current) return

    const grid = gridRef.current
    const container = (grid as unknown as { _scrollingContainer: HTMLElement })._scrollingContainer
    const mainGridRect = container.getBoundingClientRect()
    
    // マウス位置の相対座標を計算
    let mouseX = e.clientX - mainGridRect.left
    let mouseY = e.clientY - mainGridRect.top

    // ヘッダー部分のドラッグ時は座標を補正
    if (headerDragTypeRef.current === 'row') {
      mouseX = 0
    } else if (headerDragTypeRef.current === 'column') {
      mouseY = 0
    }

    // スクロールゾーンの計算
    const scrollZone = calculateScrollZone(mainGridRect)
    
    // スクロール状態の更新
    const newScrollState = calculateScrollDirection(mouseX, mouseY, scrollZone)
    setScrollState(newScrollState)

    // マウス位置の状態を更新
    lastMousePositionRef.current = {
      x: mouseX,
      y: mouseY,
      rect: mainGridRect
    }

    // 表示枠内の場合は選択範囲を更新
    if (!newScrollState.isScrolling) {
      const col = Math.min(Math.max(0, Math.floor((mouseX + container.scrollLeft) / COLUMN_WIDTH)), columnCount - 1)
      const row = Math.min(Math.max(0, Math.floor((mouseY + container.scrollTop) / ROW_HEIGHT)), rowCount - 1)

      setSelectionRange(prev => {
        if (!prev) return null

        let newRange: CellRange
        if (headerDragTypeRef.current === 'row') {
          newRange = {
            start: prev.start,
            end: { row, col: columnCount - 1 }
          }
        } else if (headerDragTypeRef.current === 'column') {
          newRange = {
            start: prev.start,
            end: { row: rowCount - 1, col }
          }
        } else {
          newRange = {
            start: prev.start,
            end: { row, col }
          }
        }

        setSelectedCell(newRange.end)
        return newRange
      })
    }
  }, [columnCount, rowCount, calculateScrollZone, calculateScrollDirection])

  const startScrolling = useCallback(() => {
    if (!lastMousePositionRef.current || !gridRef.current) return

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
    }

    const scroll = () => {
      if (!isDraggingRef.current || !gridRef.current || !lastMousePositionRef.current) return

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

      // デバッグ情報を更新
      setDebugInfo(prev => ({
        ...prev,
        scrollSpeed: { x: scrollSpeedX, y: scrollSpeedY }
      }))

      // スクロール位置の更新
      const currentScrollLeft = container.scrollLeft
      const currentScrollTop = container.scrollTop
      const maxScrollLeft = (columnCount * defaultColumnWidth) - rect.width
      const maxScrollTop = (rowCount * defaultRowHeight) - rect.height

      const newScrollLeft = Math.max(0, Math.min(maxScrollLeft, currentScrollLeft + scrollSpeedX))
      const newScrollTop = Math.max(0, Math.min(maxScrollTop, currentScrollTop + scrollSpeedY))

      if (newScrollLeft !== currentScrollLeft || newScrollTop !== currentScrollTop) {
        grid.scrollToPosition({ scrollLeft: newScrollLeft, scrollTop: newScrollTop })
      }

      // スクロールが必要な場合は次のフレームをスケジュール
      if (direction !== null) {
        rafRef.current = requestAnimationFrame(scroll)
      }
    }

    rafRef.current = requestAnimationFrame(scroll)
  }, [columnCount, rowCount, defaultColumnWidth, defaultRowHeight, scrollState])

  // スクロール状態が変更されたときにスクロールを開始/停止
  useEffect(() => {
    if (scrollState.isScrolling) {
      startScrolling()
    } else if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
    }
  }, [scrollState.isScrolling, startScrolling])

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false
    headerDragTypeRef.current = null
    isHeaderDragRef.current = false  // ヘッダードラッグ状態をリセット
    lastMousePositionRef.current = null
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      if (gridRef.current) {
        gridRef.current.recomputeGridSize()
      }
    }
  }, [])

  const isCellSelected = useCallback((row: number, col: number) => {
    if (selectionRange) {
      const minRow = Math.min(selectionRange.start.row, selectionRange.end.row)
      const maxRow = Math.max(selectionRange.start.row, selectionRange.end.row)
      const minCol = Math.min(selectionRange.start.col, selectionRange.end.col)
      const maxCol = Math.max(selectionRange.start.col, selectionRange.end.col)
      return row >= minRow && row <= maxRow && col >= minCol && col <= maxCol
    }
    return selectedCell?.row === row && selectedCell?.col === col
  }, [selectedCell, selectionRange])

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('keydown', handleKeyDown)
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [handleKeyDown, handleMouseMove, handleMouseUp])

  const handleClearSelection = useCallback(() => {
    // ドラッグ中またはヘッダードラッグ中は選択をクリアしない
    if (isDraggingRef.current || isHeaderDragRef.current) return
    setSelectedCell(null)
    setSelectionRange(null)
  }, [])

  // selectedCellが変更されたときにコールバックを呼び出す
  useEffect(() => {
    onActivePositionChange?.(selectedCell)
  }, [selectedCell, onActivePositionChange])

  // selectionRangeが変更されたときにコールバックを呼び出す
  useEffect(() => {
    onSelectionChange?.(selectionRange)
  }, [selectionRange, onSelectionChange])

  const handleCellClick = useCallback((row: number, col: number) => {
    onCellClick?.({ row, col })
  }, [onCellClick])

  const handleCellDoubleClick = useCallback((row: number, col: number) => {
    onCellDoubleClick?.({ row, col })
  }, [onCellDoubleClick])

  const handleCellContextMenu = useCallback((row: number, col: number, event: React.MouseEvent) => {
    onCellContextMenu?.({ row, col }, event)
  }, [onCellContextMenu])

  return {
    selectedCell,
    selectionRange,
    handleMouseDown,
    handleHeaderMouseDown,
    handleClearSelection,
    isCellSelected,
    handleMouseMove,
    handleCornerHeaderClick,
    handleCellClick,
    handleCellDoubleClick,
    handleCellContextMenu,
  }
} 