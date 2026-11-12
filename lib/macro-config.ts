/** Cross-market tickers stored in the `prices` table next to the ETFs (kept out of the ETF TICKERS list on purpose). */
export const MACRO_TICKERS = ['^SOX', '^IXIC', '^VIX', '^TNX', 'TWD=X'] as const

/** Large index constituents (TSMC, Hon Hai, MediaTek, Delta, Quanta, ASE, Chunghwa Telecom, Fubon FHC). */
export const BELLWETHERS = ['2330', '2317', '2454', '2308', '2382', '3711', '2412', '2881'] as const
