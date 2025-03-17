'use client'

import { useEffect, useState } from 'react'
import Spreadsheet from './components/Spreadsheet'

export default function Home() {
  // クライアントサイドでのみレンダリングを行うための状態
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  if (!isClient) {
    return <div className="w-screen h-screen p-4">Loading...</div>
  }

  return (
    <div className="w-screen h-screen p-4">
      <Spreadsheet
        rowCount={1000}
        columnCount={26}
        debug={true}
      />
    </div>
  )
}
