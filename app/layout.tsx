import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'EcoNews · 科技 ETF 分析儀',
  description: '每日財經新聞趨勢分析，科技 ETF 買進訊號',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <div className="min-h-screen bg-[#070B14] text-slate-100">
          <nav className="border-b border-white/[0.06] bg-[#070B14]/80 backdrop-blur-md sticky top-0 z-50">
            <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center font-bold text-[#070B14] text-sm select-none">E</div>
                <span className="font-semibold tracking-tight">EcoNews</span>
                <span className="hidden sm:block text-slate-500 text-sm">科技 ETF 分析儀</span>
              </div>
              <nav className="flex items-center gap-6 text-sm text-slate-400">
                <a href="/" className="hover:text-white transition-colors">今日分析</a>
                <a href="/history" className="hover:text-white transition-colors">歷史記錄</a>
                <a href="/weekly" className="hover:text-white transition-colors">週報</a>
                <a href="/monthly" className="hover:text-white transition-colors">月報</a>
              </nav>
            </div>
          </nav>
          <main className="max-w-5xl mx-auto px-6 py-10">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
