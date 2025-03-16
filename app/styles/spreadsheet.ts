import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// カラー定数
export const colors = {
  blue: {
    50: 'rgb(239 246 255)',
    100: 'rgb(219 234 254)',
    200: 'rgb(191 219 254)',
    300: 'rgb(147 197 253)',
    400: 'rgb(96 165 250)',
    500: 'rgb(59 130 246)',
    600: 'rgb(37 99 235)',
    700: 'rgb(29 78 216)',
    800: 'rgb(30 64 175)',
    900: 'rgb(30 58 138)'
  },
  gray: {
    100: 'rgb(243 244 246)',
    200: 'rgb(229 231 235)',
    300: 'rgb(209 213 219)',
    400: 'rgb(156 163 175)',
    500: 'rgb(107 114 128)',
    600: 'rgb(75 85 99)',
    700: 'rgb(55 65 81)',
    800: 'rgb(31 41 55)',
    900: 'rgb(17 24 39)'
  }
} as const

// セルの基本スタイル
export const cellStyles = {
  base: 'flex items-center px-1 cursor-pointer select-none overflow-hidden whitespace-nowrap bg-white',
  selected: 'bg-blue-50',
  active: 'z-[1]',
  hover: 'hover:bg-gray-100',
  border: 'border-r border-b border-gray-200',
  selectedBorder: 'border-2 border-blue-400 -m-[1px] z-[1]'
} as const

// ヘッダーの基本スタイル
export const headerStyles = {
  base: 'flex items-center justify-center font-semibold select-none cursor-pointer bg-gray-100',
  selected: 'bg-gray-200',
  hover: 'hover:bg-gray-200',
  border: 'border-r border-b border-gray-200'
} as const

// コーナーセルの基本スタイル
export const cornerStyles = {
  base: 'bg-gray-100 border-r border-b border-gray-200 cursor-pointer',
  hover: 'hover:bg-gray-200'
} as const

// グリッドの基本スタイル
export const gridStyles = {
  container: 'relative outline-none',
  headerContainer: 'absolute top-0',
  rowHeaderContainer: 'absolute left-0',
  mainGridContainer: 'absolute',
  grid: 'outline-none'
} as const

// レイアウトのスタイル
export const layoutStyles = {
  cell: {
    selectedMargin: '-1px'
  },
  zIndex: {
    corner: 20,
    header: 10,
    cell: 1
  },
  overflow: {
    hidden: {
      overflowX: 'hidden',
      overflowY: 'hidden'
    }
  }
} as const

// スクロールバーのスタイル
export const scrollbarStyles = {
  width: 17,
  height: 17
} as const

// デフォルトの寸法
export const defaultDimensions = {
  columnWidth: 100,
  rowHeight: 24,
  headerHeight: 24,
  headerWidth: 100
} as const 