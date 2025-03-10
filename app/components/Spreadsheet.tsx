'use client'

import React, { useRef, useCallback } from 'react'
import { AutoSizer, Grid, GridCellProps, ScrollSync } from 'react-virtualized'
import { cn } from '@/lib/utils'

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

// デフォルトのスタイル設定
const defaultStyles: SpreadsheetStyles = {
  cell: {
    base: 'flex items-center px-1 cursor-pointer select-none overflow-hidden whitespace-nowrap bg-white',
    selected: 'bg-blue-50',
    active: 'z-[1]',
    hover: 'hover:bg-gray-100',
    border: 'border-r border-b border-gray-200',
    selectedBorder: 'border-selected border-blue-400 -m-[1px] z-[1]'
  },
  header: {
    base: 'flex items-center justify-center font-semibold select-none cursor-pointer bg-gray-100',
    selected: 'bg-gray-200',
    hover: 'hover:bg-gray-200',
    border: 'border-r border-b border-gray-200'
  },
  corner: {
    base: 'bg-gray-100 border-r border-b border-gray-200 cursor-pointer',
    hover: 'hover:bg-gray-200'
  }
}

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

interface HeaderRendererProps extends GridCellProps {
  isSelected: boolean
  label: string
  onMouseDown: (e: React.MouseEvent) => void
  onResize?: (width: number) => void
}

const DEFAULT_COLUMN_WIDTH = 100
const DEFAULT_ROW_HEIGHT = 24
const DEFAULT_HEADER_HEIGHT = 24
const DEFAULT_HEADER_WIDTH = 100
const DEFAULT_SCROLLBAR_WIDTH = 17

// 列ヘッダーのデフォルトラベル (A-Z)
const DEFAULT_COLUMN_LABELS = Array.from({ length: 26 }, (_, i) => 
  String.fromCharCode(65 + i)
)

export default function Spreadsheet({ 
  rowCount = 1000, 
  columnCount = 26,
  defaultColumnWidth = DEFAULT_COLUMN_WIDTH,
  defaultRowHeight = DEFAULT_ROW_HEIGHT,
  headerHeight = DEFAULT_HEADER_HEIGHT,
  headerWidth = DEFAULT_HEADER_WIDTH,
  scrollbarWidth = DEFAULT_SCROLLBAR_WIDTH,
  className,
  cellClassName,
  headerClassName,
  selectedCellClassName,
  cellRenderer: customCellRenderer,
  headerRenderer: customHeaderRenderer,
  columnLabels = DEFAULT_COLUMN_LABELS,
  data,
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

  const {
    selectedCell,
    selectionRange,
    handleMouseDown,
    handleHeaderMouseDown,
    handleClearSelection,
    isCellSelected,
    handleMouseMove,
    handleCornerHeaderClick,
  } = useSpreadsheetSelection({
    rowCount,
    columnCount,
    gridRef: mainGridRef,
  })

  // スタイルの結合
  const mergedStyles = {
    cell: {
      ...defaultStyles.cell,
      ...styles.cell
    },
    header: {
      ...defaultStyles.header,
      ...styles.header
    },
    corner: {
      ...defaultStyles.corner,
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
    const isRangeBorder = isSelected && isRangeSelection && selectionRange && (() => {
      const minRow = Math.min(selectionRange.start.row, selectionRange.end.row)
      const maxRow = Math.max(selectionRange.start.row, selectionRange.end.row)
      const minCol = Math.min(selectionRange.start.col, selectionRange.end.col)
      const maxCol = Math.max(selectionRange.start.col, selectionRange.end.col)

      return {
        isTopBorder: rowIndex === minRow,
        isBottomBorder: rowIndex === maxRow,
        isLeftBorder: columnIndex === minCol,
        isRightBorder: columnIndex === maxCol,
      }
    })()

    // スタイルの計算
    const cellStyle = {
      ...style,
    }

    if (isRangeBorder) {
      const borderStyle = '2px solid #60a5fa'
      if (isRangeBorder.isTopBorder) cellStyle.borderTop = borderStyle
      if (isRangeBorder.isBottomBorder) cellStyle.borderBottom = borderStyle
      if (isRangeBorder.isLeftBorder) cellStyle.borderLeft = borderStyle
      if (isRangeBorder.isRightBorder) cellStyle.borderRight = borderStyle
    }

    // アクティブセルまたは選択開始セルの場合
    if ((!isRangeSelection && isActiveCell) || (isRangeSelection && isStartCell)) {
      cellStyle.borderTop = '2px solid #60a5fa'
      cellStyle.borderBottom = '2px solid #60a5fa'
      cellStyle.borderLeft = '2px solid #60a5fa'
      cellStyle.borderRight = '2px solid #60a5fa'
      cellStyle.margin = '-1px'
    }

    return (
      <div
        key={key}
        className={cn(
          mergedStyles.cell.base,
          isSelected && mergedStyles.cell.selected,
          !isSelected && mergedStyles.cell.hover,
          !isSelected && !isRangeBorder && !isActiveCell && mergedStyles.cell.border,
          ((!isRangeSelection && isActiveCell) || (isRangeSelection && isStartCell)) && mergedStyles.cell.active
        )}
        style={cellStyle}
        onMouseDown={(e) => handleMouseDown(rowIndex, columnIndex, e.shiftKey)}
      >
        {`${columnLabels[columnIndex]}${rowIndex + 1}`}
      </div>
    )
  }

  // ヘッダーセルをレンダリング
  const headerCellRenderer = ({ columnIndex, key, style }: GridCellProps) => {
    const isSelected = isCellSelected(0, columnIndex)

    return (
      <div
        key={key}
        className={cn(
          mergedStyles.header.base,
          mergedStyles.header.border,
          isSelected ? mergedStyles.header.selected : mergedStyles.header.hover
        )}
        style={{
          ...style,
        }}
        onMouseDown={(e) => handleHeaderMouseDown(columnIndex, false, e.shiftKey)}
      >
        {columnLabels[columnIndex]}
      </div>
    )
  }

  // 行ヘッダーをレンダリング
  const rowHeaderRenderer = ({ key, rowIndex, style }: GridCellProps) => {
    const isSelected = isCellSelected(rowIndex, 0)

    return (
      <div
        key={key}
        className={cn(
          mergedStyles.header.base,
          mergedStyles.header.border,
          isSelected ? mergedStyles.header.selected : mergedStyles.header.hover
        )}
        style={{
          ...style,
        }}
        onMouseDown={(e) => handleHeaderMouseDown(rowIndex, true, e.shiftKey)}
      >
        {rowIndex + 1}
      </div>
    )
  }

  return (
    <AutoSizer>
      {({ width, height }) => (
        <ScrollSync>
          {({ onScroll, scrollLeft, scrollTop }) => (
            <div 
              className="relative outline-none" 
              style={{ width, height }}
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
                  zIndex: 20,
                }}
                onClick={handleCornerHeaderClick}
              />

              {/* 列ヘッダー */}
              <div 
                className="absolute top-0"
                style={{ 
                  left: defaultColumnWidth,
                  width: width - defaultColumnWidth - scrollbarWidth,
                  height: headerHeight,
                  zIndex: 10,
                }}
                onMouseMove={(e: React.MouseEvent) => handleMouseMove(e.nativeEvent)}
              >
                <Grid
                  ref={headerGridRef}
                  className="outline-none"
                  cellRenderer={headerCellRenderer}
                  columnCount={columnCount}
                  columnWidth={() => defaultColumnWidth}
                  height={headerHeight}
                  rowCount={1}
                  rowHeight={() => headerHeight}
                  width={width - defaultColumnWidth - scrollbarWidth}
                  scrollLeft={scrollLeft}
                  style={{
                    overflowX: 'hidden',
                    overflowY: 'hidden'
                  }}
                />
              </div>

              {/* 行ヘッダー */}
              <div 
                className="absolute left-0"
                style={{ 
                  top: headerHeight,
                  width: defaultColumnWidth,
                  height: height - headerHeight - scrollbarWidth,
                  zIndex: 10,
                }}
                onMouseMove={(e: React.MouseEvent) => handleMouseMove(e.nativeEvent)}
              >
                <Grid
                  className="outline-none"
                  cellRenderer={rowHeaderRenderer}
                  columnCount={1}
                  columnWidth={() => defaultColumnWidth}
                  height={height - headerHeight - scrollbarWidth}
                  rowCount={rowCount}
                  rowHeight={() => defaultRowHeight}
                  width={defaultColumnWidth}
                  scrollTop={scrollTop}
                  style={{
                    overflowX: 'hidden',
                    overflowY: 'hidden'
                  }}
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
                onMouseMove={(e: React.MouseEvent) => handleMouseMove(e.nativeEvent)}
              >
                <Grid
                  ref={mainGridRef}
                  className="outline-none"
                  cellRenderer={cellRenderer}
                  columnCount={columnCount}
                  columnWidth={() => defaultColumnWidth}
                  height={height - headerHeight}
                  rowCount={rowCount}
                  rowHeight={() => defaultRowHeight}
                  width={width - defaultColumnWidth}
                  overscanRowCount={20}
                  overscanColumnCount={5}
                  onScroll={onScroll}
                />
              </div>
            </div>
          )}
        </ScrollSync>
      )}
    </AutoSizer>
  )
} 