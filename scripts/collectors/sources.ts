export interface RssSource {
  name: string
  url: string
}

export const RSS_SOURCES: RssSource[] = [
  { name: 'Yahoo財經', url: 'https://tw.news.yahoo.com/rss/finance' },
  { name: '自由財經', url: 'https://news.ltn.com.tw/rss/business.xml' },
  { name: '經濟日報科技', url: 'https://money.udn.com/rssfeed/news/1001/5591?ch=money' },
  { name: 'UDN科技', url: 'https://udn.com/rssfeed/news/2/6644?ch=news' },
]

export const RELEVANCE_KEYWORDS = [
  '科技', 'ETF', '半導體', '聯準會', '利率', 'AI', '輝達', '台積電',
  '美股', '那斯達克', '標普', '科技股', 'NVIDIA', 'TSMC',
]
