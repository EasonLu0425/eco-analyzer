# EcoNews — 科技 ETF 財經分析儀

## 專案概述

每日早上 08:30 自動蒐集中文財經新聞，透過 Claude AI 分析整體趨勢，
判斷是否適合買進科技股 ETF（如 00662、QQQ），以 Next.js 網頁呈現。

## 技術棧

- **前端**: Next.js 16 + App Router + shadcn/ui + Tailwind CSS v4
- **資料庫**: SQLite (`better-sqlite3`)，檔案存於 `data/eco-news.db`
- **排程**: `node-cron` — 獨立 script (`scripts/scheduler.ts`)
- **AI**: Claude claude-haiku-4-5 (`claude-haiku-4-5-20251001`) via `@anthropic-ai/sdk`
- **新聞來源**: RSS（鉅亨網、Yahoo Finance TW、MoneyDJ 等）

## 資料模型（types/index.ts）

```typescript
interface AnalysisReport {
  id: string           // ULID or UUID
  date: string         // YYYY-MM-DD
  sentimentScore: number // 0–10，10 最正面
  signal: 'strong-buy' | 'buy' | 'hold' | 'avoid' | 'strong-avoid'
  summary: string      // 100 字內繁中摘要
  risks: string[]      // 3 個風險因素
  topHeadlines: string[] // 前 5 大標題
  newsCount: number    // 分析的新聞數量
  createdAt: string    // ISO-8601
}
```

## API 路由

`GET /api/reports` — 列表（支援 `?latest=true` / `?date=YYYY-MM-DD` / `?page=N`）

## 目錄結構

```
eco-news/
├── app/
│   ├── page.tsx            # 今日儀表板（Server Component）
│   ├── history/page.tsx    # 歷史列表
│   └── api/reports/route.ts # REST API
├── components/ui/          # shadcn 元件
├── lib/db.ts               # SQLite 連線與查詢
├── types/index.ts          # 共用型別
└── scripts/
    ├── collectors/         # feat/news-collector 實作這裡
    ├── analyzers/          # feat/llm-analyzer 實作這裡
    └── scheduler.ts        # feat/scheduler 實作這裡
```

## 環境變數

複製 `.env.example` 為 `.env` 並填入：

```
ANTHROPIC_API_KEY=sk-ant-...
DATABASE_PATH=./data/eco-news.db
PORT=3001
```

## 開發指令

```bash
pnpm dev          # 啟動 Next.js dev server（port 3000）
pnpm scheduler    # 手動執行一次分析 pipeline
pnpm build        # 生產建置
```

## SQLite Schema

```sql
CREATE TABLE reports (
  id             TEXT PRIMARY KEY,
  date           TEXT UNIQUE NOT NULL,  -- YYYY-MM-DD
  sentiment_score REAL NOT NULL,
  signal         TEXT NOT NULL,
  summary        TEXT NOT NULL,
  risks          TEXT NOT NULL,         -- JSON array
  top_headlines  TEXT NOT NULL,         -- JSON array
  news_count     INTEGER NOT NULL,
  created_at     TEXT NOT NULL          -- ISO-8601
);
```

---

## Feature Branches — Worktree 並行開發指南

以下 5 個 feature branch 設計為**互相獨立**，可同時用 git worktree + Claude Code agent 開發。

### 建立 Worktree 指令

```bash
git worktree add ../eco-news-collector   feat/news-collector
git worktree add ../eco-news-analyzer    feat/llm-analyzer
git worktree add ../eco-news-scheduler   feat/scheduler
git worktree add ../eco-news-dashboard   feat/web-dashboard
git worktree add ../eco-news-history     feat/web-history
```

---

### feat/news-collector — 中文新聞蒐集器

**目錄**: `scripts/collectors/`

**目標**: 從多個中文 RSS 源蒐集財經新聞，回傳標準化 `NewsItem[]`

**RSS 來源清單**:
| 來源 | URL |
|------|-----|
| 鉅亨網 | `https://feeds.cnyes.com/market/tw/news.xml` |
| Yahoo Finance TW | `https://tw.news.yahoo.com/rss/finance` |
| MoneyDJ | `https://www.moneydj.com/rss/news/` |
| 工商時報 | `https://ctee.com.tw/feed` |

**實作清單**:
- [ ] `scripts/collectors/rss.ts` — `rss-parser` 解析，過濾關鍵字（科技、ETF、半導體、聯準會、利率）
- [ ] `scripts/collectors/sources.ts` — RSS URL 設定清單
- [ ] `scripts/collectors/index.ts` — 匯出 `collectNews(): Promise<NewsItem[]>`
- [ ] 單元測試（mock RSS 回應）
- [ ] 每次至多回傳 100 則，按 publishedAt DESC 排序

**依賴**: 無（只需 `rss-parser`，已安裝）

---

### feat/llm-analyzer — Claude AI 分析

**目錄**: `scripts/analyzers/`

**目標**: 將 `NewsItem[]` 送入 Claude claude-haiku-4-5，輸出結構化 `AnalysisResult`

**實作清單**:
- [ ] `scripts/analyzers/prompt.ts` — 繁中 prompt 模板（情緒分析 + ETF 訊號）
- [ ] `scripts/analyzers/claude.ts` — `@anthropic-ai/sdk` 呼叫，解析 JSON 回應
- [ ] `scripts/analyzers/index.ts` — 匯出 `analyzeNews(items: NewsItem[]): Promise<AnalysisResult>`
- [ ] 單元測試（mock Claude 回應）

**Prompt 範本** (繁體中文):
```
以下是今日台灣財經新聞標題，請分析後以 JSON 格式回覆：
{headlines}

請輸出：
{
  "sentimentScore": <0-10，10最正面>,
  "signal": <"strong-buy"|"buy"|"hold"|"avoid"|"strong-avoid">,
  "summary": <100字內的趨勢摘要>,
  "risks": [<風險1>, <風險2>, <風險3>]
}
```

**依賴**: 無（`@anthropic-ai/sdk` 已安裝，使用 `ANTHROPIC_API_KEY`）

---

### feat/scheduler — 每日定時排程

**目錄**: `scripts/scheduler.ts`（完整實作）

**目標**: 每日 08:30 Asia/Taipei 執行完整 pipeline（collect → analyze → save）

**實作清單**:
- [ ] 用 `node-cron` 排程 `'30 8 * * *'`（timezone: `Asia/Taipei`）
- [ ] 完整 pipeline：`collectNews()` → `analyzeNews()` → 寫入 SQLite
- [ ] 避免同一天重複分析（先查 DB）
- [ ] 結構化 console log（timestamp + 狀態）
- [ ] 整合測試（mock collector + analyzer，驗證寫入 DB）

**前置依賴**: `feat/news-collector` 和 `feat/llm-analyzer` 的 index.ts 匯出

---

### feat/web-dashboard — 主控台 UI 完整實作

**目錄**: `app/page.tsx` + `components/dashboard/`

**目標**: 替換現有靜態 page.tsx，加入真實 API 呼叫與動態元件

**實作清單**:
- [ ] `components/dashboard/SignalCard.tsx` — 訊號卡片（大型，含動畫）
- [ ] `components/dashboard/SentimentMeter.tsx` — 情緒分數可視化（環形或條狀）
- [ ] `components/dashboard/RiskList.tsx` — 風險因素列表
- [ ] `components/dashboard/HeadlineList.tsx` — 新聞標題列表
- [ ] `app/page.tsx` — 整合以上元件，從 `/api/reports?latest=true` 取資料
- [ ] 載入中骨架 (skeleton)、空值狀態

**設計方向**: 深色系金融終端風格（已在 `app/page.tsx` 建立基礎）

---

### feat/web-history — 歷史記錄頁面完整實作

**目錄**: `app/history/`

**目標**: 歷史報告列表 + 個別報告詳細頁

**實作清單**:
- [ ] `app/history/page.tsx` — 完整歷史列表，含分頁
- [ ] `app/history/[date]/page.tsx` — 個別報告詳細頁（完整展示 `AnalysisReport`）
- [ ] `components/history/SentimentChart.tsx` — 近 30 日情緒分數折線圖（用 shadcn chart 或 recharts）
- [ ] 空值與錯誤狀態處理

---

## Merge 順序建議

1. `feat/news-collector` ← 最先完成，無依賴
2. `feat/llm-analyzer`  ← 最先完成，無依賴
3. `feat/web-dashboard` + `feat/web-history` ← 並行，無依賴
4. `feat/scheduler`     ← 最後，依賴 1 + 2
