export interface RssSource {
  name: string
  url: string
}

export const RSS_SOURCES: RssSource[] = [
  { name: '鉅亨網', url: 'https://feeds.cnyes.com/market/tw/news.xml' },
  { name: 'Yahoo財經', url: 'https://tw.news.yahoo.com/rss/finance' },
  { name: 'MoneyDJ', url: 'https://www.moneydj.com/rss/news/' },
  { name: '工商時報', url: 'https://ctee.com.tw/feed' },
]

export const RELEVANCE_KEYWORDS = [
  '科技', 'ETF', '半導體', '聯準會', '利率', 'AI', '輝達', '台積電',
  '美股', '那斯達克', '標普', '科技股', 'NVIDIA', 'TSMC',
]
