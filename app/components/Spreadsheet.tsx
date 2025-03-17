'use client'

import React, { useRef, useCallback, useState } from 'react'
import { AutoSizer, Grid, GridCellProps, ScrollSync } from 'react-virtualized'
import { cn } from '@/lib/utils'
import {
  cellStyles,
  headerStyles,
  cornerStyles,
  gridStyles,
  scrollbarStyles,
  defaultDimensions,
  layoutStyles
} from '../styles/spreadsheet'

import 'react-virtualized/styles.css'
import { useSpreadsheetSelection } from '../hooks/useSpreadsheetSelection'

interface CellPosition {
  row: number
  col: number
}

interface CellRange {
  start: CellPosition
  end: CellPosition
}

// セルの値や状態を表す型
interface CellData {
  value: string | number
  type?: 'text' | 'number' | 'date'
  format?: string
  editable?: boolean
}

// 選択に関するイベント
interface SelectionEvents {
  onSelectionChange?: (range: CellRange | null) => void
  onActivePositionChange?: (position: CellPosition | null) => void
}

// セルの操作に関するイベント
interface CellEvents {
  onCellClick?: (position: CellPosition) => void
  onCellDoubleClick?: (position: CellPosition) => void
  onCellContextMenu?: (position: CellPosition, event: React.MouseEvent) => void
}

// キーボード操作に関するイベント
interface KeyboardEvents {
  onKeyDown?: (event: KeyboardEvent, selection: CellRange | null) => void
  onKeyPress?: (event: KeyboardEvent, selection: CellRange | null) => void
}

// スクロールに関するイベント
interface ScrollEvents {
  onScroll?: (scrollLeft: number, scrollTop: number) => void
  onScrollEnd?: () => void
}

// 将来の機能のためのイベント
interface EditEvents {
  onCellEdit?: (position: CellPosition, value: string) => void
  onColumnResize?: (columnIndex: number, width: number) => void
  onRowResize?: (rowIndex: number, height: number) => void
}

// スタイリングの基本設定
interface SpreadsheetStyles {
  cell?: {
    base?: string  // 基本スタイル
    selected?: string  // 選択時
    active?: string  // アクティブ時
    hover?: string  // ホバー時
    border?: string  // 通常の境界線
    selectedBorder?: string  // 選択時の境界線
  }
  header?: {
    base?: string  // 基本スタイル
    selected?: string  // 選択時
    hover?: string  // ホバー時
    border?: string  // 境界線
  }
  corner?: {
    base?: string  // 基本スタイル
    hover?: string  // ホバー時
  }
}

interface HeaderRendererProps extends GridCellProps {
  isSelected: boolean
  label: string
  onMouseDown: (e: React.MouseEvent) => void
  onResize?: (width: number) => void
}

// 列ヘッダーのデフォルトラベル (A-Z)
const DEFAULT_COLUMN_LABELS = Array.from({ length: 26 }, (_, i) => 
  String.fromCharCode(65 + i)
)

interface SpreadsheetProps extends 
  SelectionEvents,
  CellEvents,
  KeyboardEvents,
  ScrollEvents,
  EditEvents {
  // 基本設定
  rowCount?: number
  columnCount?: number
  defaultColumnWidth?: number
  defaultRowHeight?: number
  headerHeight?: number
  headerWidth?: number
  scrollbarWidth?: number

  // データ
  data?: CellData[][]
  
  // スタイリング
  className?: string
  cellClassName?: string
  headerClassName?: string
  selectedCellClassName?: string
  
  // カスタマイズ
  cellRenderer?: (props: CellRendererProps) => React.ReactNode
  headerRenderer?: (props: HeaderRendererProps) => React.ReactNode
  columnLabels?: string[]
  
  // スタイリング
  styles?: SpreadsheetStyles

  // デバッグモード
  debug?: boolean

  // 新しいプロパティ
  onContextMenu?: (e: React.MouseEvent) => void
}

interface CellRendererProps extends GridCellProps {
  isSelected: boolean
  isActiveCell: boolean
  isRangeSelection: boolean
  isStartCell: boolean
  data?: CellData
  onMouseDown: (e: React.MouseEvent) => void
  onDoubleClick?: (e: React.MouseEvent) => void
  onContextMenu?: (e: React.MouseEvent) => void
}

// デバッグ情報表示用コンポーネント
interface DebugOverlayProps {
  mousePosition: { x: number; y: number } | null
  scrollSpeed: { x: number; y: number }
  containerSize: { width: number; height: number } | null
}

const DebugOverlay: React.FC<DebugOverlayProps> = ({ mousePosition, scrollSpeed, containerSize }) => {
  return (
    <div className="fixed bottom-4 right-4 bg-black/80 text-white p-4 rounded-lg font-mono text-sm z-50">
      <div>Mouse X: {mousePosition?.x ?? 'N/A'}</div>
      <div>Mouse Y: {mousePosition?.y ?? 'N/A'}</div>
      <div>Scroll Speed X: {scrollSpeed.x.toFixed(2)}</div>
      <div>Scroll Speed Y: {scrollSpeed.y.toFixed(2)}</div>
      <div>Container Width: {containerSize?.width ?? 'N/A'}</div>
      <div>Container Height: {containerSize?.height ?? 'N/A'}</div>
    </div>
  )
}

export default function Spreadsheet({ 
  rowCount = 1000, 
  columnCount = 26,
  defaultColumnWidth = defaultDimensions.columnWidth,
  defaultRowHeight = defaultDimensions.rowHeight,
  headerHeight = defaultDimensions.headerHeight,
  headerWidth = defaultDimensions.headerWidth,
  scrollbarWidth = scrollbarStyles.width,
  className,
  cellClassName,
  headerClassName,
  selectedCellClassName,
  cellRenderer: customCellRenderer,
  headerRenderer: customHeaderRenderer,
  columnLabels = DEFAULT_COLUMN_LABELS,
  data,
  debug = false,
  onContextMenu,
  // イベントハンドラ
  onSelectionChange,
  onActivePositionChange,
  onCellClick,
  onCellDoubleClick,
  onCellContextMenu,
  onKeyDown,
  onKeyPress,
  onScroll: onScrollProp,
  onScrollEnd,
  onCellEdit,
  onColumnResize,
  onRowResize,
  styles = {},
}: SpreadsheetProps) {
  const headerGridRef = useRef<Grid>(null)
  const mainGridRef = useRef<Grid>(null)
  const [debugInfo, setDebugInfo] = useState({
    mousePosition: null as { x: number; y: number } | null,
    scrollSpeed: { x: 0, y: 0 },
    containerSize: null as { width: number; height: number } | null
  })

  const {
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
  } = useSpreadsheetSelection({
    rowCount,
    columnCount,
    gridRef: mainGridRef,
    defaultRowHeight,
    defaultColumnWidth,
    headerHeight,
    headerWidth,
    onSelectionChange,
    onActivePositionChange,
    onCellClick,
    onCellDoubleClick,
    onCellContextMenu,
    onDebugInfoChange: setDebugInfo,
  })

  // スタイルの結合
  const mergedStyles = {
    cell: {
      ...cellStyles,
      ...styles.cell
    },
    header: {
      ...headerStyles,
      ...styles.header
    },
    corner: {
      ...cornerStyles,
      ...styles.corner
    }
  }

  // セルの内容をレンダリング
  const cellRenderer = ({ columnIndex, key, rowIndex, style }: GridCellProps) => {
    const isSelected = isCellSelected(rowIndex, columnIndex)
    const isActiveCell = selectedCell?.row === rowIndex && selectedCell?.col === columnIndex
    const isRangeSelection = selectionRange && (
      selectionRange.start.row !== selectionRange.end.row || 
      selectionRange.start.col !== selectionRange.end.col
    )
    const isStartCell = selectionRange && 
      rowIndex === selectionRange.start.row && 
      columnIndex === selectionRange.start.col

    // 選択範囲の境界を計算
    const getBorderClasses = () => {
      if (!isSelected || !selectionRange) return ''

      const minRow = Math.min(selectionRange.start.row, selectionRange.end.row)
      const maxRow = Math.max(selectionRange.start.row, selectionRange.end.row)
      const minCol = Math.min(selectionRange.start.col, selectionRange.end.col)
      const maxCol = Math.max(selectionRange.start.col, selectionRange.end.col)

      const isTopBorder = rowIndex === minRow
      const isBottomBorder = rowIndex === maxRow
      const isLeftBorder = columnIndex === minCol
      const isRightBorder = columnIndex === maxCol

      return cn({
        'border-t-2 border-blue-400': isTopBorder,
        'border-b-2 border-blue-400': isBottomBorder,
        'border-l-2 border-blue-400': isLeftBorder,
        'border-r-2 border-blue-400': isRightBorder
      })
    }

    const cellContent = data?.[rowIndex]?.[columnIndex]?.value ?? `${columnLabels[columnIndex]}${rowIndex + 1}`

    return (
      <div
        key={key}
        className={cn(
          // ベーススタイル
          mergedStyles.cell.base,
          // 選択状態
          isSelected && mergedStyles.cell.selected,
          // 非選択時のホバーと境界線
          !isSelected && [
            mergedStyles.cell.hover,
            mergedStyles.cell.border
          ],
          // アクティブセルまたは選択開始セルのスタイル
          ((!isRangeSelection && isActiveCell) || (isRangeSelection && isStartCell)) && [
            'border-2 border-blue-400',
            '-m-[1px]',
            mergedStyles.cell.active
          ],
          // 選択範囲の境界線
          getBorderClasses(),
          // カスタムクラス
          cellClassName
        )}
        style={style}
        onMouseDown={(e) => handleMouseDown(rowIndex, columnIndex, e.shiftKey)}
      >
        {cellContent}
      </div>
    )
  }

  // ヘッダーセルをレンダリング
  const headerCellRenderer = ({ columnIndex, key, style }: GridCellProps) => {
    const isSelected = selectionRange && columnIndex >= Math.min(selectionRange.start.col, selectionRange.end.col) &&
                      columnIndex <= Math.max(selectionRange.start.col, selectionRange.end.col)

    return (
      <div
        key={key}
        className={cn(
          mergedStyles.header.base,
          mergedStyles.header.border,
          isSelected ? mergedStyles.header.selected : mergedStyles.header.hover,
          headerClassName
        )}
        style={style}
        onMouseDown={(e) => handleHeaderMouseDown(columnIndex, false, e.shiftKey)}
      >
        {columnLabels[columnIndex]}
      </div>
    )
  }

  // 行ヘッダーをレンダリング
  const rowHeaderRenderer = ({ key, rowIndex, style }: GridCellProps) => {
    const isSelected = selectionRange && rowIndex >= Math.min(selectionRange.start.row, selectionRange.end.row) &&
                      rowIndex <= Math.max(selectionRange.start.row, selectionRange.end.row)

    return (
      <div
        key={key}
        className={cn(
          mergedStyles.header.base,
          mergedStyles.header.border,
          isSelected ? mergedStyles.header.selected : mergedStyles.header.hover,
          headerClassName
        )}
        style={style}
        onMouseDown={(e) => handleHeaderMouseDown(rowIndex, true, e.shiftKey)}
      >
        {rowIndex + 1}
      </div>
    )
  }

  return (
    <>
      <div className={cn('relative w-full h-full overflow-hidden', className)}>
        <AutoSizer>
          {({ width, height }) => (
            <ScrollSync>
              {({ onScroll, scrollLeft, scrollTop }) => {
                // スクロール可能な領域のサイズを計算
                const scrollableWidth = width - defaultColumnWidth
                const scrollableHeight = height - headerHeight
                const totalWidth = columnCount * defaultColumnWidth
                const totalHeight = rowCount * defaultRowHeight

                return (
                  <div 
                    className="relative w-full h-full"
                    style={{ 
                      width,
                      height
                    }}
                    onMouseUp={(e) => {
                      if (e.target === e.currentTarget) {
                        handleClearSelection()
                      }
                    }}
                    onKeyDown={(e) => {
                      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                        e.preventDefault()
                      }
                    }}
                    tabIndex={0}
                  >
                    {/* 左上の空白セル */}
                    <div 
                      className={cn(
                        'absolute top-0 left-0',
                        mergedStyles.corner.base,
                        mergedStyles.corner.hover
                      )}
                      style={{ 
                        width: defaultColumnWidth,
                        height: headerHeight,
                        zIndex: layoutStyles.zIndex.corner,
                      }}
                      onClick={handleCornerHeaderClick}
                    />

                    {/* 列ヘッダー */}
                    <div 
                      className="absolute top-0"
                      style={{ 
                        left: defaultColumnWidth,
                        right: 0,
                        height: headerHeight,
                        zIndex: layoutStyles.zIndex.header,
                      }}
                    >
                      <Grid
                        ref={headerGridRef}
                        className={gridStyles.grid}
                        cellRenderer={headerCellRenderer}
                        columnCount={columnCount}
                        columnWidth={() => defaultColumnWidth}
                        height={headerHeight}
                        rowCount={1}
                        rowHeight={() => headerHeight}
                        width={scrollableWidth}
                        scrollLeft={scrollLeft}
                        style={{ overflow: 'hidden' }}
                      />
                    </div>

                    {/* 行ヘッダー */}
                    <div 
                      className="absolute left-0"
                      style={{ 
                        top: headerHeight,
                        bottom: 0,
                        width: defaultColumnWidth,
                        zIndex: layoutStyles.zIndex.header,
                      }}
                    >
                      <Grid
                        className={gridStyles.grid}
                        cellRenderer={rowHeaderRenderer}
                        columnCount={1}
                        columnWidth={() => defaultColumnWidth}
                        height={scrollableHeight}
                        rowCount={rowCount}
                        rowHeight={() => defaultRowHeight}
                        width={defaultColumnWidth}
                        scrollTop={scrollTop}
                        style={{ overflow: 'hidden' }}
                      />
                    </div>

                    {/* メインのグリッド領域 */}
                    <div
                      className="absolute"
                      style={{
                        top: headerHeight,
                        left: defaultColumnWidth,
                        right: 0,
                        bottom: 0,
                      }}
                    >
                      <Grid
                        ref={mainGridRef}
                        className={gridStyles.grid}
                        cellRenderer={cellRenderer}
                        columnCount={columnCount}
                        columnWidth={() => defaultColumnWidth}
                        height={scrollableHeight}
                        rowCount={rowCount}
                        rowHeight={() => defaultRowHeight}
                        width={scrollableWidth}
                        onScroll={onScroll}
                        overscanRowCount={20}
                        overscanColumnCount={5}
                        style={{ 
                          overflow: 'auto'
                        }}
                      />
                    </div>
                  </div>
                )
              }}
            </ScrollSync>
          )}
        </AutoSizer>
      </div>
      {debug && <DebugOverlay {...debugInfo} />}
    </>
  )
} 