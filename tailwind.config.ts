import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        spreadsheet: {
          cell: '#ffffff',
          'cell-selected': '#eff6ff',
          'cell-hover': '#f3f4f6',
          header: '#f3f4f6',
          'header-selected': '#e5e7eb',
          'header-hover': '#e5e7eb',
          border: '#e5e7eb',
          'border-selected': '#60a5fa',
        }
      },
      borderWidth: {
        'selected': '2px',
      }
    },
  },
  plugins: [],
}

export default config 