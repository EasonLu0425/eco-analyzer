# EcoNews — 台灣 ETF 財經分析儀

每日蒐集台灣財經新聞，透過 AI 分析市場情緒，產出 ETF 買賣訊號與風險提示，以 Next.js 儀表板呈現。

追蹤標的：**0050**（元大台灣50）、**00692**（富邦公司治理）、**00878**（國泰永續高股息）、**台灣加權指數**

---

## 功能

- 每日從多個中文 RSS 源蒐集財經新聞（鉅亨網、Yahoo Finance TW、MoneyDJ 等）
- AI 分析新聞情緒 + ETF 價格趨勢，輸出 `strong-buy / buy / hold / avoid / strong-avoid` 訊號
- 情緒分數（0–10）、風險因素、重點新聞與市場影響說明
- 52 週高低點位置、30日/90日漲跌幅視覺化
- 波動區間預估（`lib/vol-forecast.ts`）：EWMA 波動率 + 歷史分位數，給出 5/20/60 日 80% 價格區間。只預估「範圍多寬」，不預測方向（方向在 10 年回測中沒有可靠預測力，波動大小才有）；60 日樣本少、實測涵蓋率約 70%，頁面上有標註
- 週報與月報深度分析
- 歷史情緒走勢圖（近 30 日）

---

## 技術棧

| 層 | 技術 |
|----|------|
| 前端 | Next.js 16 App Router + Tailwind CSS v4 + shadcn/ui |
| 資料庫 | SQLite（`better-sqlite3`），存於 `data/eco-news.db` |
| 排程 | `node-cron`，每日 08:30 Asia/Taipei 自動執行 |
| AI 分析 | Claude Haiku（`@anthropic-ai/sdk`）或 Claude Code 本地互動 |
| 價格資料 | `yahoo-finance2`（增量更新，首次抓取近一年歷史） |
| 新聞來源 | `rss-parser` |

---

## 快速開始

### 1. 安裝依賴

```bash
pnpm install
```

### 2. 設定環境變數

```bash
cp .env.example .env
```

編輯 `.env`：

```env
ANTHROPIC_API_KEY=sk-ant-...      # Claude API 金鑰（排程自動分析用）
DATABASE_PATH=./data/eco-news.db  # SQLite 路徑
```

### 3. 啟動開發伺服器

```bash
pnpm dev
```

開啟 [http://localhost:3000](http://localhost:3000)

---

## 使用方式

### 手動分析（Claude Code）

在 Claude Code 中執行以下斜線指令，進行互動式分析：

```
/eco-analyze    # 蒐集今日新聞 → 更新價格 → AI 綜合分析 → 存入 DB
/eco-weekly     # 產生上週深度週報（聚合日報 + 週漲跌幅 + AI 洞察）
/eco-monthly    # 產生上月深度月報（趨勢轉折 + 資金輪動 + 投資展望）
```

### 自動排程

```bash
pnpm scheduler  # 啟動排程，每日 08:30 自動執行完整 pipeline
```

pipeline 流程：`蒐集新聞 → 更新 ETF 價格 → Claude API 分析 → 寫入 SQLite`

**日內三時段（crontab，Asia/Taipei）**：每個交易日分析三次，後者參考前者蒐集的新聞與報價
- `morning` 開盤前 08:30 起：原有流程（`cron-eco-analyze.sh`，含補漏日）
- `midday` 盤中 11:00（重試 11:30、12:00）、`close` 收盤後 14:30（重試 15:30、17:00）：`cron-eco-session.sh <session>`
- 先存報價、判斷當天台股是否開市（休市就不呼叫 Claude），再執行 `/eco-analyze <session>`
- 資料表：`news_items`（依 URL 去重並記錄首次出現時段）、`intraday_prices`（各時段報價）、
  `report_snapshots`（各時段完整分析）；`reports` 仍每天一筆（最新時段），網頁與 API 不受影響
- 所有排程共用 `flock /tmp/eco-news.lock`，避免兩個 Claude 同時跑；log 在 `logs/eco-session.log`

**週報／月報排程（crontab）**：
- 週報：每週一 09:15 / 12:15 / 15:15 / 18:15 / 21:15 執行 `scripts/cron-eco-weekly.sh`
- 月報：每月 1 日同樣時段執行 `scripts/cron-eco-monthly.sh`
- 各自先由 `check-missing-weekly.ts` / `check-missing-monthly.ts` 檢查「上週（月）有日報但無報告」才呼叫
  `claude -p "/eco-weekly"` / `"/eco-monthly"`，已產生則略過；當天重複時段只是補跑保險。
- 若當天整天沒開機就會錯過，需手動執行 `/eco-weekly` 或 `/eco-monthly`。
- log 在 `logs/eco-weekly.log`、`logs/eco-monthly.log`。

### 其他指令

```bash
pnpm dev            # 啟動 Next.js dev server（port 3000）
pnpm collect-news   # 只蒐集今日新聞（存至 data/news/YYYY-MM-DD.json）
pnpm fetch-prices   # 只更新四支標的最新價格資料
pnpm build          # 生產建置
pnpm test           # 執行測試（vitest）
pnpm test:coverage  # 測試 + 覆蓋率報告
```

### 研究腳本（訊號有沒有預測力）

報告輸出到 `data/studies/`。以下都用 `npx tsx --tsconfig scripts/tsconfig.json <script>` 執行。

| 腳本 | 用途 |
|---|---|
| `scripts/study-signals.ts` | 技術指標買賣規則在 10 年價格上的回測 |
| `scripts/study-scores.ts` | 日報新聞分數 × 價格位置的交叉表 |
| `scripts/study-pit-prepare.ts <dir>` | 產生逐日「只含當時可見資訊」的盲測輸入（新聞 15:00 前、指標到當日收盤） |
| `scripts/study-pit-backtest.ts <預測目錄>` | 評估逐日盲測預測；`--from-db` 改評估新邏輯起算日（meta `logic_v2_start`）之後的 close 快照，即真正的事前預測 |
| `scripts/fetch-macro.ts` | 抓結構化因子的 10 年歷史：費半/那指/VIX/美債/匯率（Yahoo）、法人與融資（FinMind）、權值股月營收 YoY |
| `scripts/study-structured.ts` | 預先登記 7 個結構化因子，檢定其對 5/20 日報酬的預測力（Bonferroni 校正） |
| `scripts/study-vol-calibration.ts` | 波動區間的逐日校準：名目 80% 區間在 ^TWII / 0050 / ^GSPC 的 5/20/60 日實際涵蓋率 |

注意：LLM 盲測只在模型知識截止日（約 2026-06）之後的資料才乾淨；更早的期間模型可能記得後續走勢。

---

## 頁面

| 路徑 | 說明 |
|------|------|
| `/` | 今日儀表板：訊號、情緒分數、摘要、重點新聞、ETF 價格 |
| `/history` | 歷史記錄：所有日報列表 + 近 30 日情緒走勢圖 |
| `/weekly` | 週報列表：各週平均分數、主導訊號、ETF 週漲跌幅 |
| `/monthly` | 月報列表：月度分析、情緒趨勢、投資展望 |

---

## API

```
GET /api/reports?latest=true          # 最新一筆報告
GET /api/reports?date=YYYY-MM-DD      # 指定日期報告
GET /api/reports?page=1&limit=30      # 分頁列表
```

---

## 目錄結構

```
eco-news/
├── app/
│   ├── page.tsx                  # 今日儀表板
│   ├── history/page.tsx          # 歷史列表
│   ├── weekly/page.tsx           # 週報列表
│   ├── monthly/page.tsx          # 月報列表
│   └── api/reports/route.ts      # REST API
├── components/dashboard/         # 儀表板元件（SignalCard、PriceTrendPanel 等）
├── components/history/           # 歷史頁元件（SentimentChart）
├── lib/
│   ├── db.ts                     # SQLite 連線與 migrations
│   ├── report-store.ts           # 報告讀寫（日報/週報/月報）
│   └── price-store.ts            # 價格趨勢查詢
├── scripts/
│   ├── collectors/               # RSS 新聞蒐集
│   ├── analyzers/                # Claude API 分析
│   ├── prices/                   # Yahoo Finance 價格更新
│   └── scheduler.ts              # 每日排程
├── types/index.ts                # 共用型別定義
└── data/
    ├── eco-news.db               # SQLite 資料庫（gitignored）
    └── news/                     # 每日新聞暫存（gitignored）
```

---

## 資料模型

```typescript
interface AnalysisReport {
  id: string
  date: string              // YYYY-MM-DD
  sentimentScore: number    // 0–10，10 最正面
  signal: 'strong-buy' | 'buy' | 'hold' | 'avoid' | 'strong-avoid'
  summary: string           // 120 字內繁中摘要
  risks: string[]           // 3 個風險因素
  topHeadlines: Headline[]  // 前 5 大重點新聞（含標題、摘要、市場影響）
  newsCount: number
  createdAt: string         // ISO-8601 +08:00
  priceTrends: PriceTrend[] // 四支標的最新價格與漲跌幅
}
```

---

## 注意事項

- `data/` 目錄已加入 `.gitignore`，歷史資料與 SQLite DB 不會進入版本控制
- 首次執行 `pnpm fetch-prices` 會抓取近一年歷史價格（約 243 筆/標的）
- 若無 `ANTHROPIC_API_KEY`，排程分析會回傳預設 `hold` 訊號；使用 `/eco-analyze` 則不受影響
