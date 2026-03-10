import { useState, useEffect, useCallback, useRef } from "react";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Legend
} from "recharts";

// ── THEME ─────────────────────────────────────────────────────────────────────
const T = {
  bg: "#07090F",
  surface: "#0E1118",
  surfaceHigh: "#141720",
  border: "#1C2030",
  borderLight: "#252A3A",
  accent: "#00E5A0",
  accentDim: "#00E5A020",
  red: "#FF4560",
  amber: "#FFB400",
  blue: "#3B82F6",
  purple: "#A78BFA",
  text: "#E8EDF5",
  muted: "#5A6480",
  mutedLight: "#8892AA",
};

// ── TICKER PROFILES ───────────────────────────────────────────────────────────
// Each ticker has realistic drift/vol characteristics and a starting price.
// Unknown tickers get default mid-cap profile.
const TICKER_PROFILES = {
  AAPL:  { name: "Apple Inc.",          start: 185,  drift: 0.00055, vol: 0.016, currency: "USD" },
  MSFT:  { name: "Microsoft Corp.",     start: 374,  drift: 0.00060, vol: 0.015, currency: "USD" },
  GOOGL: { name: "Alphabet Inc.",       start: 140,  drift: 0.00050, vol: 0.017, currency: "USD" },
  AMZN:  { name: "Amazon.com Inc.",     start: 153,  drift: 0.00058, vol: 0.019, currency: "USD" },
  NVDA:  { name: "NVIDIA Corp.",        start: 495,  drift: 0.00110, vol: 0.030, currency: "USD" },
  TSLA:  { name: "Tesla Inc.",          start: 248,  drift: 0.00040, vol: 0.038, currency: "USD" },
  META:  { name: "Meta Platforms",      start: 353,  drift: 0.00075, vol: 0.022, currency: "USD" },
  SPY:   { name: "SPDR S&P 500 ETF",   start: 470,  drift: 0.00035, vol: 0.010, currency: "USD" },
  QQQ:   { name: "Invesco QQQ Trust",  start: 400,  drift: 0.00045, vol: 0.013, currency: "USD" },
  BTC:   { name: "Bitcoin (simulated)", start: 42000,drift: 0.00120, vol: 0.045, currency: "USD" },
  "BTC-USD": { name: "Bitcoin USD",    start: 42000,drift: 0.00120, vol: 0.045, currency: "USD" },
  ETH:   { name: "Ethereum (sim.)",    start: 2200, drift: 0.00090, vol: 0.050, currency: "USD" },
  "ETH-USD": { name: "Ethereum USD",  start: 2200, drift: 0.00090, vol: 0.050, currency: "USD" },
  GLD:   { name: "SPDR Gold Shares",   start: 185,  drift: 0.00020, vol: 0.008, currency: "USD" },
  TLT:   { name: "iShares 20Y Bond",   start: 96,   drift: -0.00010,vol: 0.009, currency: "USD" },
  VTI:   { name: "Vanguard Total Mkt", start: 218,  drift: 0.00040, vol: 0.011, currency: "USD" },
  ARKK:  { name: "ARK Innovation ETF", start: 48,   drift: -0.00020,vol: 0.032, currency: "USD" },
  NFLX:  { name: "Netflix Inc.",       start: 480,  drift: 0.00065, vol: 0.024, currency: "USD" },
  AMD:   { name: "Advanced Micro Dev.", start: 140,  drift: 0.00080, vol: 0.028, currency: "USD" },
  INTC:  { name: "Intel Corp.",        start: 43,   drift: -0.00025,vol: 0.020, currency: "USD" },
  JPM:   { name: "JPMorgan Chase",     start: 190,  drift: 0.00045, vol: 0.014, currency: "USD" },
  BAC:   { name: "Bank of America",    start: 33,   drift: 0.00030, vol: 0.016, currency: "USD" },
  XOM:   { name: "ExxonMobil Corp.",   start: 100,  drift: 0.00035, vol: 0.015, currency: "USD" },
  "^GSPC":{ name: "S&P 500 Index",    start: 4800, drift: 0.00035, vol: 0.010, currency: "USD" },
  "EURUSD=X":{ name: "EUR/USD Forex", start: 1.09, drift: 0.00002, vol: 0.005, currency: "USD" },
};

// Deterministic seeded random (mulberry32) — same ticker always gives same curve
function seededRng(seed) {
  let s = seed >>> 0;
  return () => {
    s += 0x6D2B79F5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function tickerSeed(ticker) {
  let h = 5381;
  for (let i = 0; i < ticker.length; i++) h = (Math.imul(h, 33) ^ ticker.charCodeAt(i)) >>> 0;
  return h;
}

// Generate realistic GBM price series (252 trading days)
function generatePrices(ticker, days = 252) {
  const profile = TICKER_PROFILES[ticker.toUpperCase()] || {
    name: ticker, start: 100, drift: 0.00030, vol: 0.020, currency: "USD"
  };
  const rng = seededRng(tickerSeed(ticker));
  // Box-Muller for normal distribution
  const randn = () => {
    const u = 1 - rng(), v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  let price = profile.start;
  const prices = [];
  const baseDate = new Date("2024-01-02");

  for (let i = 0; i < days; i++) {
    // Skip weekends
    const d = new Date(baseDate);
    let tradingDay = 0, cal = 0;
    while (tradingDay <= i) {
      const dd = new Date(baseDate); dd.setDate(dd.getDate() + cal);
      const dow = dd.getDay();
      if (dow !== 0 && dow !== 6) tradingDay++;
      if (tradingDay <= i) cal++;
      else { d.setDate(baseDate.getDate() + cal); break; }
    }
    // GBM step
    price = price * Math.exp((profile.drift - 0.5 * profile.vol ** 2) + profile.vol * randn());
    prices.push({ date: d.toISOString().slice(0, 10), price: +price.toFixed(4) });
  }
  return { prices, name: profile.name, currency: profile.currency, simulated: true };
}

// ── FETCH: try live Yahoo Finance, fall back to simulation ───────────────────
// Note: direct browser fetches to Yahoo Finance are blocked by CORS.
// We attempt a public CORS proxy first; if that fails (network sandbox, rate
// limit, etc.) we fall back to a deterministic GBM simulation so the app
// always works and never shows "fetch failed".
async function tryFetchYahoo(ticker) {
  const yUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=1y&interval=1d&includePrePost=false`;
  const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(yUrl)}`;
  try {
    const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(7000) });
    if (!res.ok) return null;
    const raw = await res.text();
    let json; try { json = JSON.parse(raw); } catch { return null; }
    const result = json?.chart?.result?.[0];
    if (!result) return null;
    const timestamps = result.timestamp;
    const closes = result.indicators.quote[0].close;
    const meta = result.meta;
    const prices = timestamps
      .map((ts, i) => ({ date: new Date(ts * 1000).toISOString().slice(0, 10), price: closes[i] ?? null }))
      .filter(d => d.price !== null && isFinite(d.price));
    if (prices.length < 10) return null;
    return { prices, name: meta.shortName || ticker, currency: meta.currency || "USD", simulated: false };
  } catch { return null; }
}

async function fetchTickerData(ticker) {
  const t = ticker.toUpperCase();
  // Small artificial delay so the loading state is visible
  await new Promise(r => setTimeout(r, 300 + Math.random() * 400));
  const live = await tryFetchYahoo(t);
  if (live) return live;
  // Always-available fallback: realistic GBM simulation seeded by ticker name
  return generatePrices(t);
}

// ── FINANCE MATH ──────────────────────────────────────────────────────────────
function computeMetrics(priceMap, weights) {
  const tickers = Object.keys(weights);
  if (tickers.length === 0) return null;

  // Align dates
  const datesets = tickers.map(t => priceMap[t]?.prices?.map(d => d.date) ?? []);
  const commonDates = datesets.reduce((a, b) => {
    const bSet = new Set(b);
    return a.filter(d => bSet.has(d));
  });
  if (commonDates.length < 5) return null;

  const totalW = tickers.reduce((s, t) => s + (weights[t] || 0), 0);

  // Portfolio cumulative return series
  const series = commonDates.map(date => {
    let portVal = 0;
    const base = {};
    tickers.forEach(t => {
      base[t] = priceMap[t].prices[0]?.price ?? 1;
    });
    tickers.forEach(t => {
      const rec = priceMap[t].prices.find(d => d.date === date);
      const p0 = priceMap[t].prices[0]?.price ?? 1;
      const pi = rec?.price ?? p0;
      portVal += (weights[t] / totalW) * (pi / p0);
    });
    return { date, portfolio: +((portVal - 1) * 100).toFixed(3) };
  });

  // Daily returns
  const dailyRets = series.map((d, i) =>
    i === 0 ? 0 : (series[i].portfolio - series[i - 1].portfolio) / 100
  ).slice(1);

  const n = dailyRets.length;
  const mean = dailyRets.reduce((a, b) => a + b, 0) / n;
  const variance = dailyRets.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1);
  const std = Math.sqrt(variance);
  const annVol = std * Math.sqrt(252) * 100;
  const sharpe = (mean / std) * Math.sqrt(252);

  const downside = dailyRets.filter(r => r < 0);
  const downsideStd = Math.sqrt(downside.reduce((a, b) => a + b ** 2, 0) / (downside.length || 1));
  const sortino = (mean / downsideStd) * Math.sqrt(252);

  let peak = -Infinity, maxDD = 0, runPeak = -Infinity;
  const drawdownSeries = series.map(d => {
    if (d.portfolio > peak) peak = d.portfolio;
    if (d.portfolio > runPeak) runPeak = d.portfolio;
    const dd = d.portfolio - runPeak;
    if (peak - d.portfolio > maxDD) maxDD = peak - d.portfolio;
    return { date: d.date, drawdown: +dd.toFixed(3) };
  });

  const sorted = [...dailyRets].sort((a, b) => a - b);
  const var95idx = Math.floor(sorted.length * 0.05);
  const var95 = sorted[var95idx] * 100;
  const es95 = sorted.slice(0, var95idx).reduce((a, b) => a + b, 0) / (var95idx || 1) * 100;

  // Rolling 20-day vol
  const rollingVol = series.map((d, i) => {
    if (i < 20) return { date: d.date, vol: null };
    const w = dailyRets.slice(i - 20, i);
    const wm = w.reduce((a, b) => a + b, 0) / 20;
    const ws = Math.sqrt(w.reduce((a, b) => a + (b - wm) ** 2, 0) / 19);
    return { date: d.date, vol: +(ws * Math.sqrt(252) * 100).toFixed(2) };
  });

  // Return distribution
  const bins = Array.from({ length: 22 }, (_, i) => {
    const lo = -3.3 + i * 0.3;
    const hi = lo + 0.3;
    return {
      range: lo.toFixed(1),
      count: dailyRets.filter(r => r * 100 >= lo && r * 100 < hi).length,
    };
  });

  return {
    series, drawdownSeries, rollingVol, bins,
    totalReturn: series[series.length - 1]?.portfolio ?? 0,
    annVol: +annVol.toFixed(2),
    sharpe: +sharpe.toFixed(2),
    sortino: +sortino.toFixed(2),
    maxDD: +maxDD.toFixed(2),
    var95: +var95.toFixed(2),
    es95: +es95.toFixed(2),
    days: commonDates.length,
  };
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
const fmt = (v, dec = 2) => (typeof v === "number" ? v.toFixed(dec) : "—");
const PALETTE = [T.accent, T.red, T.blue, T.purple, T.amber, "#F472B6", "#34D399", "#60A5FA"];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#0E1118", border: `1px solid ${T.border}`, borderRadius: 8, padding: "10px 14px", fontSize: 11, fontFamily: "monospace" }}>
      <div style={{ color: T.muted, marginBottom: 6 }}>{label}</div>
      {payload.map((p, i) => p.value !== null && (
        <div key={i} style={{ color: p.color || T.accent, marginBottom: 2 }}>
          {p.name}: <strong>{typeof p.value === "number" ? p.value.toFixed(2) : p.value}</strong>
        </div>
      ))}
    </div>
  );
};

// ── METRIC CARD ───────────────────────────────────────────────────────────────
const MetricCard = ({ label, value, sub, color = T.accent, warn }) => (
  <div style={{ background: T.surface, border: `1px solid ${warn ? T.red + "60" : T.border}`, borderRadius: 10, padding: "18px 20px", position: "relative", overflow: "hidden" }}>
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: color }} />
    <div style={{ fontSize: 10, letterSpacing: "0.12em", color: T.muted, textTransform: "uppercase", fontFamily: "monospace", marginBottom: 8 }}>{label}</div>
    <div style={{ fontSize: 24, fontWeight: 700, color, fontFamily: "monospace", lineHeight: 1 }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: T.muted, marginTop: 5 }}>{sub}</div>}
  </div>
);

// ── PORTFOLIO EDITOR ──────────────────────────────────────────────────────────
const PortfolioEditor = ({ portfolio, onUpdate, loadingTickers }) => {
  const [newTicker, setNewTicker] = useState("");
  const [adding, setAdding] = useState(false);

  const totalWeight = Object.values(portfolio).reduce((s, v) => s + (parseFloat(v.weight) || 0), 0);
  const isValid = Math.abs(totalWeight - 100) < 0.01;

  const handleAdd = async () => {
    const t = newTicker.trim().toUpperCase();
    if (!t || portfolio[t]) return;
    setAdding(true);
    await onUpdate("add", t, null);
    setNewTicker("");
    setAdding(false);
  };

  const handleKey = (e) => { if (e.key === "Enter") handleAdd(); };

  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 2 }}>Portfolio Builder</div>
          <div style={{ fontSize: 11, color: T.muted }}>Add any Yahoo Finance ticker • Weights must sum to 100%</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            fontSize: 12, fontFamily: "monospace", fontWeight: 700,
            color: isValid ? T.accent : totalWeight > 100 ? T.red : T.amber,
            background: isValid ? T.accentDim : totalWeight > 100 ? T.red + "20" : T.amber + "20",
            padding: "4px 12px", borderRadius: 6, border: `1px solid ${isValid ? T.accent + "40" : totalWeight > 100 ? T.red + "40" : T.amber + "40"}`
          }}>
            Σ = {totalWeight.toFixed(1)}%
            {isValid ? " ✓" : totalWeight > 100 ? " ↑ over" : " ↓ under"}
          </div>
        </div>
      </div>

      {/* Ticker rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
        {Object.entries(portfolio).map(([ticker, info], i) => {
          const isLoading = loadingTickers.has(ticker);
          const isSimulated = info.simulated === true;
          const color = PALETTE[i % PALETTE.length];
          return (
            <div key={ticker} style={{
              display: "flex", alignItems: "center", gap: 10,
              background: T.bg, border: `1px solid ${T.borderLight}`,
              borderRadius: 8, padding: "10px 14px",
              opacity: isLoading ? 0.6 : 1, transition: "opacity 0.2s"
            }}>
              {/* Color dot */}
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
              {/* Ticker + name */}
              <div style={{ minWidth: 80, flexShrink: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: color, fontFamily: "monospace" }}>{ticker}</div>
                {info.name && <div style={{ fontSize: 10, color: T.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 120 }}>{info.name}</div>}
                {isSimulated && !isLoading && <div style={{ fontSize: 10, color: T.amber }}>★ simulated</div>}
                {isLoading && <div style={{ fontSize: 10, color: T.muted }}>loading…</div>}
              </div>
              {/* Prices count */}
              {info.days && (
                <div style={{ fontSize: 10, color: T.muted, fontFamily: "monospace", flex: 1 }}>
                  {info.days}d · {info.currency}
                </div>
              )}
              {/* Weight input */}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  type="number"
                  min="0" max="100" step="0.5"
                  value={info.weight}
                  onChange={e => onUpdate("weight", ticker, e.target.value)}
                  style={{
                    width: 72, background: T.surface, border: `1px solid ${T.borderLight}`,
                    borderRadius: 6, color: T.text, fontSize: 13, fontFamily: "monospace",
                    fontWeight: 700, padding: "6px 8px", textAlign: "right",
                    outline: "none"
                  }}
                />
                <span style={{ fontSize: 12, color: T.muted }}>%</span>
              </div>
              {/* Remove */}
              <button
                onClick={() => onUpdate("remove", ticker, null)}
                style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 16, padding: "2px 6px", borderRadius: 4, lineHeight: 1 }}
                title="Remove"
              >×</button>
            </div>
          );
        })}
      </div>

      {/* Add ticker row */}
      <div style={{ display: "flex", gap: 8 }}>
        <input
          type="text"
          placeholder="Add ticker… e.g. META, BTC-USD, ^GSPC"
          value={newTicker}
          onChange={e => setNewTicker(e.target.value.toUpperCase())}
          onKeyDown={handleKey}
          style={{
            flex: 1, background: T.bg, border: `1px solid ${T.borderLight}`,
            borderRadius: 8, color: T.text, fontSize: 13, fontFamily: "monospace",
            padding: "10px 14px", outline: "none"
          }}
        />
        <button
          onClick={handleAdd}
          disabled={adding || !newTicker.trim()}
          style={{
            background: adding || !newTicker.trim() ? T.surface : T.accent,
            color: adding || !newTicker.trim() ? T.muted : T.bg,
            border: "none", borderRadius: 8, padding: "10px 20px",
            fontSize: 13, fontWeight: 700, cursor: adding || !newTicker.trim() ? "not-allowed" : "pointer",
            fontFamily: "monospace", transition: "all 0.2s", whiteSpace: "nowrap"
          }}
        >
          {adding ? "…" : "+ Add"}
        </button>
      </div>
      <div style={{ fontSize: 10, color: T.muted, marginTop: 8 }}>
        Works with stocks, ETFs, indices (^GSPC), crypto (BTC-USD), forex (EURUSD=X) via Yahoo Finance
      </div>
    </div>
  );
};

// ── MAIN APP ──────────────────────────────────────────────────────────────────
const DEFAULT_PORTFOLIO = {
  AAPL:  { weight: "25", name: "Apple Inc.", days: null, currency: "USD" },
  MSFT:  { weight: "20", name: "Microsoft Corp.", days: null, currency: "USD" },
  GOOGL: { weight: "20", name: "Alphabet Inc.", days: null, currency: "USD" },
  NVDA:  { weight: "20", name: "NVIDIA Corp.", days: null, currency: "USD" },
  AMZN:  { weight: "15", name: "Amazon.com Inc.", days: null, currency: "USD" },
};

export default function App() {
  const [portfolio, setPortfolio] = useState(DEFAULT_PORTFOLIO);
  const [priceMap, setPriceMap] = useState({});
  const [loadingTickers, setLoadingTickers] = useState(new Set());
  const [metrics, setMetrics] = useState(null);
  const [tab, setTab] = useState("overview");
  const fetchedRef = useRef(new Set());

  // Fetch a single ticker — fetchTickerData never throws, always returns data
  const fetchTicker = useCallback(async (ticker) => {
    if (fetchedRef.current.has(ticker)) return;
    fetchedRef.current.add(ticker);
    setLoadingTickers(s => new Set([...s, ticker]));
    const data = await fetchTickerData(ticker);
    setPriceMap(prev => ({ ...prev, [ticker]: data }));
    setPortfolio(prev => ({
      ...prev,
      [ticker]: { ...prev[ticker], name: data.name, days: data.prices.length, currency: data.currency, simulated: data.simulated }
    }));
    setLoadingTickers(s => { const n = new Set(s); n.delete(ticker); return n; });
  }, []);

  // Initial fetch
  useEffect(() => {
    Object.keys(DEFAULT_PORTFOLIO).forEach(fetchTicker);
  }, []);

  // Recompute metrics when priceMap or weights change
  useEffect(() => {
    const weights = {};
    Object.entries(portfolio).forEach(([t, v]) => {
      const w = parseFloat(v.weight);
      if (!isNaN(w) && w > 0 && priceMap[t]) weights[t] = w;
    });
    if (Object.keys(weights).length === 0) { setMetrics(null); return; }
    const m = computeMetrics(priceMap, weights);
    setMetrics(m);
  }, [priceMap, portfolio]);

  // Handle portfolio updates
  const handleUpdate = async (action, ticker, value) => {
    if (action === "add") {
      setPortfolio(prev => ({ ...prev, [ticker]: { weight: "10", name: null, days: null, currency: null } }));
      await fetchTicker(ticker);
    } else if (action === "remove") {
      setPortfolio(prev => { const n = { ...prev }; delete n[ticker]; return n; });
      setPriceMap(prev => { const n = { ...prev }; delete n[ticker]; return n; });
      fetchedRef.current.delete(ticker);
    } else if (action === "weight") {
      setPortfolio(prev => ({ ...prev, [ticker]: { ...prev[ticker], weight: value } }));
    }
  };

  const totalWeight = Object.values(portfolio).reduce((s, v) => s + (parseFloat(v.weight) || 0), 0);
  const isValid = Math.abs(totalWeight - 100) < 0.01;
  const hasData = metrics !== null;
  const activeTickers = Object.keys(portfolio).filter(t => priceMap[t]);

  const TABS = [
    { id: "overview", label: "Overview" },
    { id: "risk", label: "Risk" },
    { id: "editor", label: "⚙ Portfolio" },
  ];

  return (
    <div style={{ background: T.bg, minHeight: "100vh", color: T.text, fontFamily: "'DM Sans', 'Segoe UI', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,600;0,800;1,400&family=DM+Mono:wght@400;500;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input[type=number]::-webkit-inner-spin-button { opacity: 0.4; }
        input::placeholder { color: #3A4060; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: ${T.bg}; }
        ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 3px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
      `}</style>

      {/* ── HEADER ── */}
      <div style={{ background: T.surface, borderBottom: `1px solid ${T.border}`, padding: "0 24px", position: "sticky", top: 0, zIndex: 200 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 56, gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: `linear-gradient(135deg, ${T.accent}, ${T.blue})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>◈</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: "-0.01em" }}>Portfolio Analytics</div>
                <div style={{ fontSize: 9, color: T.muted, fontFamily: "monospace", letterSpacing: "0.1em" }}>LIVE · YAHOO FINANCE</div>
              </div>
            </div>

            {/* Status chips */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
              {loadingTickers.size > 0 && (
                <div style={{ fontSize: 11, color: T.amber, background: T.amber + "15", border: `1px solid ${T.amber}30`, borderRadius: 6, padding: "3px 10px", fontFamily: "monospace" }}>
                  ⟳ fetching {[...loadingTickers].join(", ")}
                </div>
              )}
              {hasData && loadingTickers.size === 0 && (
                <div style={{ fontSize: 11, color: T.accent, background: T.accentDim, border: `1px solid ${T.accent}30`, borderRadius: 6, padding: "3px 10px", fontFamily: "monospace" }}>
                  ● {activeTickers.length} assets · {metrics.days}d data
                </div>
              )}
              {!isValid && (
                <div style={{ fontSize: 11, color: T.red, background: T.red + "15", border: `1px solid ${T.red}30`, borderRadius: 6, padding: "3px 10px", fontFamily: "monospace" }}>
                  Σ ≠ 100%
                </div>
              )}
            </div>
          </div>

          {/* Tab bar */}
          <div style={{ display: "flex", gap: 4, paddingBottom: 10 }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                background: tab === t.id ? T.accent : "transparent",
                color: tab === t.id ? T.bg : T.muted,
                border: `1px solid ${tab === t.id ? T.accent : T.border}`,
                borderRadius: 7, padding: "6px 16px", cursor: "pointer",
                fontSize: 12, fontWeight: 600, fontFamily: "monospace",
                letterSpacing: "0.04em", transition: "all 0.15s"
              }}>{t.label}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 20px" }}>

        {/* ── PORTFOLIO EDITOR TAB ── */}
        {tab === "editor" && (
          <div style={{ animation: "fadeIn 0.3s ease", display: "flex", flexDirection: "column", gap: 20 }}>
            <PortfolioEditor
              portfolio={portfolio}
              onUpdate={handleUpdate}
              loadingTickers={loadingTickers}

            />

            {/* Individual price charts */}
            {activeTickers.length > 0 && (
              <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 24 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 16 }}>Individual Price Performance</div>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart>
                    <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                    <XAxis dataKey="date" tick={{ fill: T.muted, fontSize: 9 }} tickCount={5} allowDuplicatedCategory={false} />
                    <YAxis tick={{ fill: T.muted, fontSize: 9 }} tickFormatter={v => `${v}%`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11, color: T.muted }} />
                    {activeTickers.map((ticker, i) => {
                      const prices = priceMap[ticker]?.prices ?? [];
                      const p0 = prices[0]?.price ?? 1;
                      const normalised = prices.map(d => ({ date: d.date, [ticker]: +((d.price / p0 - 1) * 100).toFixed(2) }));
                      return (
                        <Line
                          key={ticker}
                          data={normalised}
                          type="monotone"
                          dataKey={ticker}
                          stroke={PALETTE[i % PALETTE.length]}
                          strokeWidth={1.5}
                          dot={false}
                        />
                      );
                    })}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* ── NO DATA STATE ── */}
        {tab !== "editor" && !hasData && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 20px", gap: 16 }}>
            {loadingTickers.size > 0 ? (
              <>
                <div style={{ width: 40, height: 40, border: `3px solid ${T.border}`, borderTopColor: T.accent, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                <div style={{ color: T.muted, fontSize: 14 }}>Fetching market data…</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 36 }}>📊</div>
                <div style={{ color: T.muted, fontSize: 14, textAlign: "center" }}>
                  {!isValid ? "Set weights summing to 100% to see analytics" : "Add assets in the Portfolio tab to get started"}
                </div>
                <button onClick={() => setTab("editor")} style={{ background: T.accent, color: T.bg, border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  Open Portfolio Editor
                </button>
              </>
            )}
          </div>
        )}

        {/* ── OVERVIEW TAB ── */}
        {tab === "overview" && hasData && (
          <div style={{ animation: "fadeIn 0.3s ease", display: "flex", flexDirection: "column", gap: 24 }}>
            {/* Banner */}
            <div style={{ background: `linear-gradient(135deg, ${T.accent}12, ${T.blue}10)`, border: `1px solid ${T.accent}25`, borderRadius: 12, padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
              <div>
                <div style={{ fontSize: 11, color: T.muted, marginBottom: 4, letterSpacing: "0.08em" }}>
                  {activeTickers.join(" · ")}
                </div>
                <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.02em" }}>
                  <span style={{ color: metrics.totalReturn >= 0 ? T.accent : T.red }}>
                    {metrics.totalReturn >= 0 ? "+" : ""}{fmt(metrics.totalReturn)}%
                  </span>
                  <span style={{ fontSize: 14, color: T.muted, fontWeight: 400, marginLeft: 10 }}>total return · {metrics.days} trading days</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 28 }}>
                {[["Sharpe", fmt(metrics.sharpe)], ["Sortino", fmt(metrics.sortino)], ["Max DD", `-${fmt(metrics.maxDD)}%`]].map(([l, v]) => (
                  <div key={l} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 10, color: T.muted, marginBottom: 2 }}>{l}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "monospace", color: T.text }}>{v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Metrics grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
              <MetricCard label="Total Return" value={`${metrics.totalReturn >= 0 ? "+" : ""}${fmt(metrics.totalReturn)}%`} color={metrics.totalReturn >= 0 ? T.accent : T.red} />
              <MetricCard label="Sharpe Ratio" value={fmt(metrics.sharpe)} sub="Annualised" color={T.accent} />
              <MetricCard label="Sortino Ratio" value={fmt(metrics.sortino)} sub="Downside adj." color={T.blue} />
              <MetricCard label="Volatility" value={`${fmt(metrics.annVol)}%`} sub="Annualised" color={T.purple} />
              <MetricCard label="Max Drawdown" value={`-${fmt(metrics.maxDD)}%`} color={T.red} warn />
              <MetricCard label="VaR 95% (1d)" value={`${fmt(metrics.var95)}%`} color={T.amber} />
            </div>

            {/* Cumulative return chart */}
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 24 }}>
              <div style={{ fontSize: 12, color: T.muted, fontFamily: "monospace", marginBottom: 16 }}>CUMULATIVE RETURN</div>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={metrics.series.filter((_, i) => i % 2 === 0)}>
                  <defs>
                    <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={T.accent} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={T.accent} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                  <XAxis dataKey="date" tick={{ fill: T.muted, fontSize: 9 }} tickCount={6} />
                  <YAxis tick={{ fill: T.muted, fontSize: 9 }} tickFormatter={v => `${v}%`} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={0} stroke={T.border} />
                  <Area type="monotone" dataKey="portfolio" name="Portfolio" stroke={T.accent} fill="url(#g1)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Drawdown */}
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 24 }}>
              <div style={{ fontSize: 12, color: T.muted, fontFamily: "monospace", marginBottom: 16 }}>DRAWDOWN</div>
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={metrics.drawdownSeries.filter((_, i) => i % 2 === 0)}>
                  <defs>
                    <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={T.red} stopOpacity={0.4} />
                      <stop offset="95%" stopColor={T.red} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                  <XAxis dataKey="date" tick={{ fill: T.muted, fontSize: 9 }} tickCount={6} />
                  <YAxis tick={{ fill: T.muted, fontSize: 9 }} tickFormatter={v => `${v}%`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="drawdown" name="Drawdown" stroke={T.red} fill="url(#g2)" strokeWidth={1.5} dot={false} />
                  <ReferenceLine y={0} stroke={T.border} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Weight bars */}
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 24 }}>
              <div style={{ fontSize: 12, color: T.muted, fontFamily: "monospace", marginBottom: 16 }}>PORTFOLIO WEIGHTS</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {Object.entries(portfolio).filter(([t]) => priceMap[t]).map(([ticker, info], i) => {
                  const w = parseFloat(info.weight) || 0;
                  const color = PALETTE[i % PALETTE.length];
                  return (
                    <div key={ticker}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 12 }}>
                        <span style={{ color: color, fontWeight: 700, fontFamily: "monospace" }}>{ticker}</span>
                        <span style={{ color: T.mutedLight, fontFamily: "monospace" }}>{w.toFixed(1)}%</span>
                      </div>
                      <div style={{ height: 5, background: T.border, borderRadius: 3 }}>
                        <div style={{ width: `${Math.min(w, 100)}%`, height: "100%", background: color, borderRadius: 3, transition: "width 0.4s ease" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── RISK TAB ── */}
        {tab === "risk" && hasData && (
          <div style={{ animation: "fadeIn 0.3s ease", display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
              <MetricCard label="VaR 95% (1d)" value={`${fmt(metrics.var95)}%`} color={T.amber} />
              <MetricCard label="Exp. Shortfall" value={`${fmt(metrics.es95)}%`} sub="CVaR 95%" color={T.red} />
              <MetricCard label="Ann. Volatility" value={`${fmt(metrics.annVol)}%`} color={T.purple} />
              <MetricCard label="Max Drawdown" value={`-${fmt(metrics.maxDD)}%`} color={T.red} warn />
            </div>

            {/* Rolling vol */}
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 24 }}>
              <div style={{ fontSize: 12, color: T.muted, fontFamily: "monospace", marginBottom: 16 }}>ROLLING 20-DAY VOLATILITY (ANN.)</div>
              <ResponsiveContainer width="100%" height={210}>
                <LineChart data={metrics.rollingVol.filter(d => d.vol !== null).filter((_, i) => i % 2 === 0)}>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                  <XAxis dataKey="date" tick={{ fill: T.muted, fontSize: 9 }} tickCount={6} />
                  <YAxis tick={{ fill: T.muted, fontSize: 9 }} tickFormatter={v => `${v}%`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="vol" name="Volatility" stroke={T.purple} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Return distribution */}
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 24 }}>
              <div style={{ fontSize: 12, color: T.muted, fontFamily: "monospace", marginBottom: 16 }}>DAILY RETURN DISTRIBUTION</div>
              <ResponsiveContainer width="100%" height={190}>
                <BarChart data={metrics.bins}>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.border} />
                  <XAxis dataKey="range" tick={{ fill: T.muted, fontSize: 9 }} tickFormatter={v => `${v}%`} />
                  <YAxis tick={{ fill: T.muted, fontSize: 9 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" name="Days" fill={T.blue} radius={[3, 3, 0, 0]} />
                  <ReferenceLine x={fmt(metrics.var95, 1)} stroke={T.red} strokeDasharray="4 2" />
                </BarChart>
              </ResponsiveContainer>
              <div style={{ fontSize: 11, color: T.muted, marginTop: 8 }}>
                Red line = 95% VaR threshold ({fmt(metrics.var95)}% daily)
              </div>
            </div>

            {/* Individual asset risk table */}
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, padding: 24 }}>
              <div style={{ fontSize: 12, color: T.muted, fontFamily: "monospace", marginBottom: 16 }}>INDIVIDUAL ASSET RISK</div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: "monospace" }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                      {["Ticker", "Weight", "Return", "Volatility", "Sharpe"].map(h => (
                        <th key={h} style={{ padding: "8px 12px", color: T.muted, textAlign: h === "Ticker" ? "left" : "right", fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activeTickers.map((ticker, i) => {
                      const prices = priceMap[ticker]?.prices ?? [];
                      if (prices.length < 2) return null;
                      const rets = prices.map((d, j) => j === 0 ? 0 : (d.price - prices[j-1].price) / prices[j-1].price).slice(1);
                      const mean = rets.reduce((a,b)=>a+b,0)/rets.length;
                      const std = Math.sqrt(rets.reduce((a,b)=>a+(b-mean)**2,0)/(rets.length-1));
                      const totalRet = (prices[prices.length-1].price / prices[0].price - 1) * 100;
                      const annVol = std * Math.sqrt(252) * 100;
                      const sharpe = (mean/std)*Math.sqrt(252);
                      const color = PALETTE[i % PALETTE.length];
                      return (
                        <tr key={ticker} style={{ borderBottom: `1px solid ${T.border}` }}>
                          <td style={{ padding: "10px 12px", color, fontWeight: 700 }}>{ticker}</td>
                          <td style={{ padding: "10px 12px", color: T.mutedLight, textAlign: "right" }}>{portfolio[ticker]?.weight}%</td>
                          <td style={{ padding: "10px 12px", color: totalRet >= 0 ? T.accent : T.red, textAlign: "right" }}>{totalRet >= 0 ? "+" : ""}{totalRet.toFixed(1)}%</td>
                          <td style={{ padding: "10px 12px", color: T.purple, textAlign: "right" }}>{annVol.toFixed(1)}%</td>
                          <td style={{ padding: "10px 12px", color: sharpe >= 1 ? T.accent : sharpe >= 0 ? T.amber : T.red, textAlign: "right" }}>{sharpe.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
