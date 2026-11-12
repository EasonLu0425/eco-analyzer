import type { Metadata } from 'next'
import { Geist, Geist_Mono, Instrument_Serif } from 'next/font/google'
import Link from 'next/link'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })
const instrumentSerif = Instrument_Serif({
  variable: '--font-instrument-serif',
  subsets: ['latin'],
  weight: '400',
})

export const metadata: Metadata = {
  title: 'EcoNews · 科技 ETF 分析儀',
  description: '每日財經新聞趨勢分析，科技 ETF 買進訊號',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW">
      <body className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} antialiased bg-bg text-ink`}>
        <nav className="border-b border-edge sticky top-0 z-50 bg-bg/95 backdrop-blur-sm">
          <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link href="/" className="font-semibold tracking-tight hover:opacity-70 transition-opacity">
              EcoNews
            </Link>
            <div className="flex items-center gap-6 text-sm text-dim">
              <Link href="/" className="hover:text-ink transition-colors">今日</Link>
              <Link href="/portfolio" className="hover:text-ink transition-colors">持倉</Link>
              <Link href="/history" className="hover:text-ink transition-colors">歷史</Link>
              <Link href="/weekly" className="hover:text-ink transition-colors">週報</Link>
              <Link href="/monthly" className="hover:text-ink transition-colors">月報</Link>
              <Link href="/chat" className="hover:text-ink transition-colors">助手</Link>
            </div>
          </div>
        </nav>
        <main className="max-w-4xl mx-auto px-6 py-10">
          {children}
        </main>
      </body>
    </html>
  )
}
