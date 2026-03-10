import { useState, useEffect, useCallback, useRef } from "react";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Legend
} from "recharts";

// ── THEMES ────────────────────────────────────────────────────────────────────
const DARK = {
  bg: "#07090F", surface: "#0E1118", surfaceHigh: "#141720",
  border: "#1C2030", borderLight: "#252A3A",
  accent: "#00E5A0", accentDim: "#00E5A020",
  red: "#FF4560", amber: "#FFB400", blue: "#3B82F6", purple: "#A78BFA",
  text: "#E8EDF5", muted: "#5A6480", mutedLight: "#8892AA",
  tooltip: "#0E1118", isDark: true,
};
const LIGHT = {
  bg: "#F4F6FA", surface: "#FFFFFF", surfaceHigh: "#EEF1F8",
  border: "#DDE2EE", borderLight: "#CDD4E8",
  accent: "#00A878", accentDim: "#00A87815",
  red: "#E03050", amber: "#D09000", blue: "#2563EB", purple: "#7C3AED",
  text: "#0F1623", muted: "#6B7898", mutedLight: "#8892AA",
  tooltip: "#FFFFFF", isDark: false,
};

// ── TICKER PROFILES (simulation fallback) ─────────────────────────────────────
const TICKER_PROFILES = {
  AAPL:  { name: "Apple Inc.",          start: 185,   drift: 0.00055, vol: 0.016 },
  MSFT:  { name: "Microsoft Corp.",     start: 374,   drift: 0.00060, vol: 0.015 },
  GOOGL: { name: "Alphabet Inc.",       start: 140,   drift: 0.00050, vol: 0.017 },
  AMZN:  { name: "Amazon.com Inc.",     start: 153,   drift: 0.00058, vol: 0.019 },
  NVDA:  { name: "NVIDIA Corp.",        start: 495,   drift: 0.00110, vol: 0.030 },
  TSLA:  { name: "Tesla Inc.",          start: 248,   drift: 0.00040, vol: 0.038 },
  META:  { name: "Meta Platforms",      start: 353,   drift: 0.00075, vol: 0.022 },
  SPY:   { name: "SPDR S&P 500 ETF",   start: 470,   drift: 0.00035, vol: 0.010 },
  QQQ:   { name: "Invesco QQQ Trust",  start: 400,   drift: 0.00045, vol: 0.013 },
  "^GSPC":{ name: "S&P 500 Index",     start: 4800,  drift: 0.00035, vol: 0.010 },
  "^NDX": { name: "Nasdaq 100",        start: 16000, drift: 0.00045, vol: 0.013 },
  "^DJI": { name: "Dow Jones IA",      start: 37000, drift: 0.00030, vol: 0.009 },
  "^RUT": { name: "Russell 2000",      start: 2000,  drift: 0.00025, vol: 0.014 },
  "^FTSE":{ name: "FTSE 100",          start: 7600,  drift: 0.00020, vol: 0.009 },
  "^GDAXI":{ name: "DAX",             start: 16500, drift: 0.00028, vol: 0.011 },
  "^FCHI":{ name: "CAC 40",            start: 7500,  drift: 0.00025, vol: 0.010 },
  "^N225":{ name: "Nikkei 225",        start: 33000, drift: 0.00032, vol: 0.012 },
  "^HSI": { name: "Hang Seng",         start: 16000, drift: -0.00010, vol: 0.015 },
  TLT:   { name: "iShares 20Y UST",    start: 96,    drift: -0.00010, vol: 0.009 },
  IEF:   { name: "iShares 7-10Y UST",  start: 98,    drift: 0.00005, vol: 0.006 },
  GLD:   { name: "SPDR Gold Shares",   start: 185,   drift: 0.00020, vol: 0.008 },
  "BTC-USD": { name: "Bitcoin USD",    start: 42000, drift: 0.00120, vol: 0.045 },
  "ETH-USD": { name: "Ethereum USD",   start: 2200,  drift: 0.00090, vol: 0.050 },
};

function seededRng(seed) {
  let s = seed >>> 0;
  return () => { s += 0x6D2B79F5; let t = Math.imul(s^(s>>>15),1|s); t^=t+Math.imul(t^(t>>>7),61|t); return ((t^(t>>>14))>>>0)/4294967296; };
}
function tickerSeed(t) { let h=5381; for(let i=0;i<t.length;i++) h=(Math.imul(h,33)^t.charCodeAt(i))>>>0; return h; }
function generatePrices(ticker) {
  const p = TICKER_PROFILES[ticker.toUpperCase()] || { name: ticker, start: 100, drift: 0.0003, vol: 0.020 };
  const rng = seededRng(tickerSeed(ticker));
  const randn = () => { const u=1-rng(),v=rng(); return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v); };
  let price = p.start; const prices = []; const base = new Date("2024-01-02");
  let cal=0, trading=0;
  while(trading<252) {
    const d=new Date(base); d.setDate(base.getDate()+cal);
    if(d.getDay()!==0&&d.getDay()!==6) { price=price*Math.exp((p.drift-0.5*p.vol**2)+p.vol*randn()); prices.push({date:d.toISOString().slice(0,10),price:+price.toFixed(4)}); trading++; }
    cal++;
  }
  return { prices, name: p.name, currency: "USD", simulated: true };
}

// ── FETCH ─────────────────────────────────────────────────────────────────────
async function tryFetchViaBackend(ticker, range="1y") {
  try {
    const res = await fetch(`/api/quote?ticker=${encodeURIComponent(ticker)}&range=${range}`, { signal: AbortSignal.timeout(9000) });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.prices || data.prices.length < 10) return null;
    return { prices: data.prices, name: data.name, currency: data.currency, simulated: false };
  } catch { return null; }
}
async function fetchTickerData(ticker, range="1y") {
  const live = await tryFetchViaBackend(ticker.toUpperCase(), range);
  return live || generatePrices(ticker.toUpperCase());
}

// ── FINANCE MATH ──────────────────────────────────────────────────────────────
function computeMetrics(priceMap, weights, benchmarkMap) {
  const tickers = Object.keys(weights);
  if (!tickers.length) return null;
  const allKeys = [...tickers, ...Object.keys(benchmarkMap)];
  const datesets = allKeys.map(t => (priceMap[t]||benchmarkMap[t])?.prices?.map(d=>d.date)??[]);
  const commonDates = datesets.reduce((a,b)=>{ const s=new Set(b); return a.filter(d=>s.has(d)); });
  if (commonDates.length < 5) return null;
  const totalW = tickers.reduce((s,t)=>s+(weights[t]||0),0);

  const portValues = commonDates.map(date => {
    let val=0;
    tickers.forEach(t=>{
      const prices=priceMap[t].prices, p0=prices[0].price, rec=prices.find(d=>d.date===date);
      val+=(weights[t]/totalW)*((rec?.price??p0)/p0);
    });
    return val;
  });

  const series = commonDates.map((date,i)=>{
    const obj={date,portfolio:+((portValues[i]-1)*100).toFixed(3)};
    Object.entries(benchmarkMap).forEach(([bKey,bData])=>{
      const p0=bData.prices[0].price, rec=bData.prices.find(d=>d.date===date);
      obj[bKey]=+((((rec?.price??p0)/p0)-1)*100).toFixed(3);
    });
    return obj;
  });

  const dailyRets = portValues.map((v,i)=>i===0?0:(v-portValues[i-1])/portValues[i-1]).slice(1);
  const n=dailyRets.length, mean=dailyRets.reduce((a,b)=>a+b,0)/n;
  const variance=dailyRets.reduce((a,b)=>a+(b-mean)**2,0)/(n-1), std=Math.sqrt(variance);
  const annVol=std*Math.sqrt(252)*100, sharpe=(mean/std)*Math.sqrt(252);
  const downside=dailyRets.filter(r=>r<0);
  const downsideStd=Math.sqrt(downside.reduce((a,b)=>a+b**2,0)/(downside.length||1));
  const sortino=(mean/downsideStd)*Math.sqrt(252);

  let peak=-Infinity, maxDD=0, runPeak=-Infinity;
  const drawdownSeries=series.map(d=>{
    if(d.portfolio>peak)peak=d.portfolio;
    if(d.portfolio>runPeak)runPeak=d.portfolio;
    const dd=d.portfolio-runPeak;
    if(peak-d.portfolio>maxDD)maxDD=peak-d.portfolio;
    return {date:d.date,drawdown:+dd.toFixed(3)};
  });

  const sorted=[...dailyRets].sort((a,b)=>a-b);
  const var95idx=Math.floor(sorted.length*0.05);
  const var95=sorted[var95idx]*100;
  const es95=sorted.slice(0,var95idx).reduce((a,b)=>a+b,0)/(var95idx||1)*100;

  const rollingVol=series.map((d,i)=>{
    if(i<20)return{date:d.date,vol:null};
    const w=dailyRets.slice(i-20,i), wm=w.reduce((a,b)=>a+b,0)/20;
    return{date:d.date,vol:+(Math.sqrt(w.reduce((a,b)=>a+(b-wm)**2,0)/19)*Math.sqrt(252)*100).toFixed(2)};
  });

  const bins=Array.from({length:22},(_,i)=>{ const lo=-3.3+i*0.3; return{range:lo.toFixed(1),count:dailyRets.filter(r=>r*100>=lo&&r*100<lo+0.3).length}; });

  const benchmarkMetrics={};
  Object.entries(benchmarkMap).forEach(([bKey,bData])=>{
    const bPrices=bData.prices.filter(d=>commonDates.includes(d.date));
    if(bPrices.length<2)return;
    const bRets=bPrices.map((d,i)=>i===0?0:(d.price-bPrices[i-1].price)/bPrices[i-1].price).slice(1);
    const bMean=bRets.reduce((a,b)=>a+b,0)/bRets.length;
    const bStd=Math.sqrt(bRets.reduce((a,b)=>a+(b-bMean)**2,0)/(bRets.length-1));
    const cov=dailyRets.reduce((s,r,i)=>s+(r-mean)*(bRets[i]-bMean),0)/(n-1);
    const beta=cov/(bStd**2), alpha=(mean-beta*bMean)*252*100;
    const active=dailyRets.map((r,i)=>r-bRets[i]);
    const activeMean=active.reduce((a,b)=>a+b,0)/active.length;
    const te=Math.sqrt(active.reduce((a,b)=>a+(b-activeMean)**2,0)/(active.length-1))*Math.sqrt(252)*100;
    const ir=(activeMean*252)/(te/100);
    benchmarkMetrics[bKey]={beta:+beta.toFixed(3),alpha:+alpha.toFixed(2),te:+te.toFixed(2),ir:+ir.toFixed(2),corr:+(cov/(std*bStd)).toFixed(3)};
  });

  const annReturn=mean*252*100, calmar=maxDD>0?+(annReturn/maxDD).toFixed(2):null;
  return { series, drawdownSeries, rollingVol, bins,
    totalReturn:series[series.length-1]?.portfolio??0, annReturn:+annReturn.toFixed(2),
    annVol:+annVol.toFixed(2), sharpe:+sharpe.toFixed(2), sortino:+sortino.toFixed(2),
    calmar, maxDD:+maxDD.toFixed(2), var95:+var95.toFixed(2), es95:+es95.toFixed(2),
    days:commonDates.length, benchmarkMetrics };
}

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
const RANGES = [
  {label:"1M",value:"1mo"},{label:"3M",value:"3mo"},{label:"6M",value:"6mo"},
  {label:"1Y",value:"1y"},{label:"2Y",value:"2y"},{label:"5Y",value:"5y"},{label:"Max",value:"max"},
];

const BENCHMARK_GROUPS = [
  { group: "US Equity", items: [
    {ticker:"^GSPC", label:"S&P 500",      desc:"Large-cap US equities"},
    {ticker:"^DJI",  label:"Dow Jones",    desc:"30 blue-chip US stocks"},
    {ticker:"^NDX",  label:"Nasdaq 100",   desc:"Top 100 Nasdaq companies"},
    {ticker:"^RUT",  label:"Russell 2000", desc:"US small-cap equities"},
    {ticker:"SPY",   label:"SPY ETF",       desc:"S&P 500 tracker ETF"},
    {ticker:"QQQ",   label:"QQQ ETF",       desc:"Nasdaq 100 tracker ETF"},
    {ticker:"IWM",   label:"IWM ETF",       desc:"Russell 2000 tracker ETF"},
  ]},
  { group: "Global Equity", items: [
    {ticker:"^FTSE",  label:"FTSE 100",     desc:"UK large-cap equities"},
    {ticker:"^GDAXI", label:"DAX",          desc:"German blue-chip equities"},
    {ticker:"^FCHI",  label:"CAC 40",       desc:"French equities"},
    {ticker:"^N225",  label:"Nikkei 225",   desc:"Japanese equities"},
    {ticker:"^HSI",   label:"Hang Seng",    desc:"Hong Kong equities"},
    {ticker:"EEM",    label:"EEM ETF",       desc:"Emerging markets ETF"},
    {ticker:"VEA",    label:"VEA ETF",       desc:"Developed markets ex-US"},
  ]},
  { group: "Fixed Income", items: [
    {ticker:"TLT",  label:"TLT (20Y UST)",   desc:"iShares 20yr US Treasury"},
    {ticker:"IEF",  label:"IEF (7-10Y UST)", desc:"iShares 7-10yr Treasury"},
    {ticker:"BND",  label:"BND Total Bond",  desc:"Vanguard Total Bond Market"},
    {ticker:"HYG",  label:"HYG High Yield",  desc:"iShares High Yield Corp"},
    {ticker:"LQD",  label:"LQD IG Corp",     desc:"iShares Investment Grade"},
  ]},
  { group: "Commodities & Crypto", items: [
    {ticker:"GLD",     label:"GLD Gold",    desc:"SPDR Gold Shares"},
    {ticker:"SLV",     label:"SLV Silver",  desc:"iShares Silver Trust"},
    {ticker:"USO",     label:"USO Oil",     desc:"US Oil Fund"},
    {ticker:"BTC-USD", label:"Bitcoin",     desc:"Bitcoin / USD"},
    {ticker:"ETH-USD", label:"Ethereum",    desc:"Ethereum / USD"},
  ]},
  { group: "Factor / Style", items: [
    {ticker:"VTV",  label:"VTV Value",      desc:"Vanguard Value ETF"},
    {ticker:"VUG",  label:"VUG Growth",     desc:"Vanguard Growth ETF"},
    {ticker:"MTUM", label:"MTUM Momentum",  desc:"iShares Momentum Factor"},
    {ticker:"USMV", label:"USMV Min Vol",   desc:"iShares Min Volatility"},
    {ticker:"QUAL", label:"QUAL Quality",   desc:"iShares Quality Factor"},
  ]},
];

const PALETTE = ["#00E5A0","#FF4560","#3B82F6","#A78BFA","#FFB400","#F472B6","#34D399","#60A5FA"];
const BENCH_COLORS = ["#94A3B8","#60A5FA","#F472B6","#FBBF24","#A78BFA","#FB923C","#34D399"];
const getBenchColor = (ticker, list) => BENCH_COLORS[list.indexOf(ticker) % BENCH_COLORS.length];

const METRIC_TOOLTIPS = {
  "Total Return": "Total percentage gain/loss over the selected period.",
  "Ann. Return": "Total return scaled to a 1-year equivalent.",
  "Sharpe Ratio": "Excess return per unit of total risk. Above 1.0 is good, above 2.0 is excellent.",
  "Sortino Ratio": "Like Sharpe but only penalises downside volatility — more relevant for asymmetric returns.",
  "Calmar Ratio": "Annualised return divided by max drawdown. Above 1.0 means returns compensate for drawdown risk.",
  "Volatility": "Annualised standard deviation of daily returns.",
  "Max Drawdown": "Largest peak-to-trough decline. Key metric for capital preservation.",
  "VaR 95% (1d)": "Worst daily loss expected 95% of the time (historical simulation).",
  "Exp. Shortfall": "Average loss on the worst 5% of days — what you lose when VaR is breached (CVaR).",
  "Beta": "Sensitivity to benchmark. β > 1 = more volatile than market; β < 0 = inversely correlated.",
  "Alpha (ann.)": "Jensen's Alpha: annualised excess return after adjusting for market risk. Positive = outperformance.",
  "Tracking Error": "Annualised std dev of active returns vs benchmark. Lower = more index-like.",
  "Info. Ratio": "Active return divided by tracking error. Above 0.5 is strong skill signal.",
  "Correlation": "Pearson correlation of daily returns with benchmark.",
};

const DEFAULT_PORTFOLIO = {
  AAPL:  { weight:"25", name:"Apple Inc.",      days:null, currency:"USD" },
  MSFT:  { weight:"20", name:"Microsoft Corp.", days:null, currency:"USD" },
  GOOGL: { weight:"20", name:"Alphabet Inc.",   days:null, currency:"USD" },
  NVDA:  { weight:"20", name:"NVIDIA Corp.",    days:null, currency:"USD" },
  AMZN:  { weight:"15", name:"Amazon.com Inc.", days:null, currency:"USD" },
};

// ── PDF EXPORT ────────────────────────────────────────────────────────────────
function exportToPDF(metrics, portfolio, range) {
  const win = window.open("","_blank");
  const weights = Object.entries(portfolio).map(([t,v])=>`<tr><td>${t}</td><td>${v.name||""}</td><td style="text-align:right;font-weight:700">${v.weight}%</td></tr>`).join("");
  const bRows = Object.entries(metrics.benchmarkMetrics||{}).map(([b,m])=>
    `<tr><td><strong>${b}</strong></td><td style="text-align:right">${m.beta.toFixed(3)}</td>
    <td style="text-align:right;color:${m.alpha>=0?"#00A878":"#E03050"}">${m.alpha>=0?"+":""}${m.alpha.toFixed(2)}%</td>
    <td style="text-align:right">${m.te.toFixed(2)}%</td><td style="text-align:right">${m.ir.toFixed(2)}</td>
    <td style="text-align:right">${m.corr.toFixed(3)}</td></tr>`).join("");
  win.document.write(`<!DOCTYPE html><html><head><title>Portfolio Report</title>
  <style>body{font-family:'Segoe UI',sans-serif;max-width:900px;margin:40px auto;color:#1a1a2e;padding:0 24px}
  h1{font-size:26px;border-bottom:3px solid #00A878;padding-bottom:12px;margin-bottom:4px}
  h2{font-size:13px;text-transform:uppercase;letter-spacing:.1em;color:#64748b;margin:28px 0 12px}
  .meta{color:#64748b;font-size:12px;margin-bottom:24px}
  .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:8px}
  .card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 16px;border-top:3px solid #00A878}
  .card.r{border-top-color:#E03050}.card.b{border-top-color:#2563EB}.card.p{border-top-color:#7C3AED}.card.a{border-top-color:#D09000}
  .lbl{font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:#718096;margin-bottom:5px}
  .val{font-size:20px;font-weight:700;font-family:monospace}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th{background:#f1f5f9;padding:9px 12px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#64748b}
  td{padding:9px 12px;border-bottom:1px solid #e2e8f0}
  .footer{margin-top:36px;font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:14px}
  </style></head><body>
  <h1>📊 Portfolio Analytics Report</h1>
  <div class="meta">Period: <strong>${range.toUpperCase()}</strong> &nbsp;·&nbsp; Date: <strong>${new Date().toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})}</strong> &nbsp;·&nbsp; ${metrics.days} trading days</div>
  <h2>Performance</h2>
  <div class="grid">
    <div class="card"><div class="lbl">Total Return</div><div class="val" style="color:${metrics.totalReturn>=0?"#00A878":"#E03050"}">${metrics.totalReturn>=0?"+":""}${metrics.totalReturn.toFixed(2)}%</div></div>
    <div class="card"><div class="lbl">Ann. Return</div><div class="val">${metrics.annReturn>=0?"+":""}${metrics.annReturn.toFixed(2)}%</div></div>
    <div class="card b"><div class="lbl">Sharpe</div><div class="val" style="color:#2563EB">${metrics.sharpe.toFixed(2)}</div></div>
    <div class="card b"><div class="lbl">Sortino</div><div class="val" style="color:#2563EB">${metrics.sortino.toFixed(2)}</div></div>
    <div class="card r"><div class="lbl">Max Drawdown</div><div class="val" style="color:#E03050">-${metrics.maxDD.toFixed(2)}%</div></div>
    <div class="card p"><div class="lbl">Volatility</div><div class="val" style="color:#7C3AED">${metrics.annVol.toFixed(2)}%</div></div>
    <div class="card a"><div class="lbl">VaR 95%</div><div class="val" style="color:#D09000">${metrics.var95.toFixed(2)}%</div></div>
    <div class="card r"><div class="lbl">CVaR 95%</div><div class="val" style="color:#E03050">${metrics.es95.toFixed(2)}%</div></div>
    ${metrics.calmar?`<div class="card b"><div class="lbl">Calmar</div><div class="val" style="color:#2563EB">${metrics.calmar.toFixed(2)}</div></div>`:""}
  </div>
  <h2>Weights</h2>
  <table><thead><tr><th>Ticker</th><th>Name</th><th style="text-align:right">Weight</th></tr></thead><tbody>${weights}</tbody></table>
  ${bRows?`<h2>Benchmark Analysis</h2>
  <table><thead><tr><th>Benchmark</th><th style="text-align:right">Beta</th><th style="text-align:right">Alpha (ann.)</th><th style="text-align:right">Track. Error</th><th style="text-align:right">Info. Ratio</th><th style="text-align:right">Correlation</th></tr></thead><tbody>${bRows}</tbody></table>`:""}
  <div class="footer">Portfolio Analytics Dashboard · Yahoo Finance data · ${new Date().toISOString()}</div>
  <script>window.onload=()=>window.print();</script></body></html>`);
  win.document.close();
}

// ── INFO TOOLTIP ──────────────────────────────────────────────────────────────
function InfoTooltip({text,T}) {
  const [show,setShow]=useState(false);
  return (
    <span style={{position:"relative",display:"inline-flex",alignItems:"center"}}>
      <span onMouseEnter={()=>setShow(true)} onMouseLeave={()=>setShow(false)}
        style={{width:14,height:14,borderRadius:"50%",background:T.border,color:T.muted,fontSize:9,fontWeight:700,
          display:"inline-flex",alignItems:"center",justifyContent:"center",cursor:"help",marginLeft:5,flexShrink:0}}>?</span>
      {show&&<span style={{position:"absolute",left:20,top:-4,background:T.tooltip,border:`1px solid ${T.border}`,
        borderRadius:8,padding:"8px 12px",fontSize:11,color:T.text,width:220,zIndex:999,
        boxShadow:"0 8px 24px rgba(0,0,0,0.3)",lineHeight:1.5,pointerEvents:"none"}}>{text}</span>}
    </span>
  );
}

// ── METRIC CARD ───────────────────────────────────────────────────────────────
function MetricCard({label,value,sub,color,warn,T}) {
  const c=color||T.accent;
  return (
    <div style={{background:T.surface,border:`1px solid ${warn?T.red+"60":T.border}`,borderRadius:10,padding:"18px 20px",position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:c}}/>
      <div style={{display:"flex",alignItems:"center",marginBottom:8}}>
        <span style={{fontSize:10,letterSpacing:"0.12em",color:T.muted,textTransform:"uppercase",fontFamily:"monospace"}}>{label}</span>
        {METRIC_TOOLTIPS[label]&&<InfoTooltip text={METRIC_TOOLTIPS[label]} T={T}/>}
      </div>
      <div style={{fontSize:24,fontWeight:700,color:c,fontFamily:"monospace",lineHeight:1}}>{value}</div>
      {sub&&<div style={{fontSize:11,color:T.muted,marginTop:5}}>{sub}</div>}
    </div>
  );
}

// ── CHART TOOLTIP ─────────────────────────────────────────────────────────────
function ChartTip({active,payload,label,T}) {
  if(!active||!payload?.length)return null;
  return (
    <div style={{background:T.tooltip,border:`1px solid ${T.border}`,borderRadius:8,padding:"10px 14px",fontSize:11,fontFamily:"monospace",boxShadow:"0 4px 16px rgba(0,0,0,0.2)"}}>
      <div style={{color:T.muted,marginBottom:6}}>{label}</div>
      {payload.map((p,i)=>p.value!==null&&(
        <div key={i} style={{color:p.color||T.accent,marginBottom:2}}>{p.name}: <strong>{typeof p.value==="number"?p.value.toFixed(2):p.value}</strong></div>
      ))}
    </div>
  );
}

// ── BENCHMARK SELECTOR ────────────────────────────────────────────────────────
function BenchmarkSelector({activeBenches,onToggle,onAddCustom,T}) {
  const [customInput,setCustomInput]=useState("");
  const [open,setOpen]=useState(false);

  const handleAddCustom=()=>{
    const t=customInput.trim().toUpperCase();
    if(!t)return;
    onAddCustom(t);
    setCustomInput("");
    setOpen(false);
  };

  return (
    <div style={{position:"relative"}}>
      {/* Active benchmark chips */}
      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
        {activeBenches.map((b,i)=>(
          <div key={b} style={{display:"flex",alignItems:"center",gap:6,background:T.surface,
            border:`1px solid ${getBenchColor(b,activeBenches)}50`,borderRadius:8,
            padding:"6px 12px",cursor:"pointer"}} onClick={()=>onToggle(b)}>
            <div style={{width:8,height:8,borderRadius:"50%",background:getBenchColor(b,activeBenches)}}/>
            <span style={{fontSize:12,fontWeight:700,fontFamily:"monospace",color:getBenchColor(b,activeBenches)}}>{b}</span>
            {activeBenches.length>1&&<span style={{fontSize:10,color:T.muted,marginLeft:2}}>×</span>}
          </div>
        ))}
        <button onClick={()=>setOpen(o=>!o)} style={{background:T.surface,border:`1px solid ${T.border}`,
          borderRadius:8,padding:"6px 14px",cursor:"pointer",fontSize:12,color:T.muted,fontFamily:"monospace"}}>
          + Add benchmark
        </button>
      </div>

      {/* Dropdown */}
      {open&&(
        <div style={{position:"absolute",top:"100%",left:0,marginTop:8,background:T.surface,
          border:`1px solid ${T.border}`,borderRadius:12,padding:20,zIndex:500,
          width:560,maxHeight:460,overflowY:"auto",boxShadow:"0 16px 48px rgba(0,0,0,0.4)"}}>
          <div style={{fontSize:11,color:T.muted,fontFamily:"monospace",marginBottom:14}}>
            SELECT BENCHMARKS (max 5) · {activeBenches.length}/5 active
          </div>
          {BENCHMARK_GROUPS.map(group=>(
            <div key={group.group} style={{marginBottom:16}}>
              <div style={{fontSize:10,color:T.muted,letterSpacing:"0.1em",textTransform:"uppercase",fontFamily:"monospace",marginBottom:8}}>{group.group}</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                {group.items.map(item=>{
                  const isActive=activeBenches.includes(item.ticker);
                  const color=isActive?getBenchColor(item.ticker,activeBenches):T.muted;
                  return (
                    <div key={item.ticker} onClick={()=>{onToggle(item.ticker);}}
                      style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",
                        background:isActive?T.bg:T.surfaceHigh,
                        border:`1px solid ${isActive?color+"50":T.borderLight}`,
                        borderRadius:8,cursor:"pointer",opacity:!isActive&&activeBenches.length>=5?0.4:1}}>
                      <div style={{width:8,height:8,borderRadius:"50%",background:color,flexShrink:0}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:12,fontWeight:700,fontFamily:"monospace",color}}>{item.label}</div>
                        <div style={{fontSize:10,color:T.muted,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{item.desc}</div>
                      </div>
                      {isActive&&<span style={{fontSize:10,color}}>✓</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {/* Custom input */}
          <div style={{borderTop:`1px solid ${T.border}`,paddingTop:14,marginTop:4}}>
            <div style={{fontSize:10,color:T.muted,letterSpacing:"0.1em",textTransform:"uppercase",fontFamily:"monospace",marginBottom:8}}>CUSTOM TICKER</div>
            <div style={{display:"flex",gap:8}}>
              <input type="text" placeholder="e.g. ARKK, ^STOXX50E, GC=F…"
                value={customInput} onChange={e=>setCustomInput(e.target.value.toUpperCase())}
                onKeyDown={e=>e.key==="Enter"&&handleAddCustom()}
                style={{flex:1,background:T.bg,border:`1px solid ${T.borderLight}`,borderRadius:8,
                  color:T.text,fontSize:12,fontFamily:"monospace",padding:"8px 12px",outline:"none"}}/>
              <button onClick={handleAddCustom} disabled={!customInput.trim()||activeBenches.length>=5}
                style={{background:T.accent,color:T.isDark?"#07090F":"#fff",border:"none",borderRadius:8,
                  padding:"8px 16px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"monospace",
                  opacity:!customInput.trim()||activeBenches.length>=5?0.4:1}}>Add</button>
            </div>
          </div>
          <button onClick={()=>setOpen(false)} style={{marginTop:12,background:"none",border:"none",color:T.muted,cursor:"pointer",fontSize:11,fontFamily:"monospace"}}>Close ↑</button>
        </div>
      )}
    </div>
  );
}

// ── PORTFOLIO EDITOR ──────────────────────────────────────────────────────────
function PortfolioEditor({portfolio,onUpdate,loadingTickers,T}) {
  const [newTicker,setNewTicker]=useState(""); const [adding,setAdding]=useState(false);
  const totalWeight=Object.values(portfolio).reduce((s,v)=>s+(parseFloat(v.weight)||0),0);
  const isValid=Math.abs(totalWeight-100)<0.01;
  const handleAdd=async()=>{ const t=newTicker.trim().toUpperCase(); if(!t||portfolio[t])return; setAdding(true); await onUpdate("add",t,null); setNewTicker(""); setAdding(false); };
  return (
    <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,padding:24}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:12}}>
        <div>
          <div style={{fontSize:13,fontWeight:700,color:T.text,marginBottom:2}}>Portfolio Builder</div>
          <div style={{fontSize:11,color:T.muted}}>Add any Yahoo Finance ticker · Weights must sum to 100%</div>
        </div>
        <div style={{fontSize:12,fontFamily:"monospace",fontWeight:700,
          color:isValid?T.accent:totalWeight>100?T.red:T.amber,
          background:isValid?T.accentDim:T.border+"80",padding:"4px 12px",borderRadius:6}}>
          Σ = {totalWeight.toFixed(1)}% {isValid?"✓":totalWeight>100?"↑":"↓"}
        </div>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
        {Object.entries(portfolio).map(([ticker,info],i)=>{
          const isLoading=loadingTickers.has(ticker), color=PALETTE[i%PALETTE.length];
          return (
            <div key={ticker} style={{display:"flex",alignItems:"center",gap:10,background:T.bg,
              border:`1px solid ${T.borderLight}`,borderRadius:8,padding:"10px 14px",opacity:isLoading?0.6:1}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:color,flexShrink:0}}/>
              <div style={{minWidth:80,flexShrink:0}}>
                <div style={{fontSize:13,fontWeight:700,color,fontFamily:"monospace"}}>{ticker}</div>
                {info.name&&<div style={{fontSize:10,color:T.muted,maxWidth:130,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{info.name}</div>}
                {isLoading&&<div style={{fontSize:10,color:T.muted}}>loading…</div>}
                {info.simulated&&!isLoading&&<div style={{fontSize:10,color:T.amber}}>★ simulated</div>}
              </div>
              {info.days&&<div style={{fontSize:10,color:T.muted,fontFamily:"monospace",flex:1}}>{info.days}d · {info.currency}</div>}
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <input type="number" min="0" max="100" step="0.5" value={info.weight}
                  onChange={e=>onUpdate("weight",ticker,e.target.value)}
                  style={{width:72,background:T.surface,border:`1px solid ${T.borderLight}`,borderRadius:6,
                    color:T.text,fontSize:13,fontFamily:"monospace",fontWeight:700,padding:"6px 8px",textAlign:"right",outline:"none"}}/>
                <span style={{fontSize:12,color:T.muted}}>%</span>
              </div>
              <button onClick={()=>onUpdate("remove",ticker,null)}
                style={{background:"none",border:"none",color:T.muted,cursor:"pointer",fontSize:16,padding:"2px 6px"}}>×</button>
            </div>
          );
        })}
      </div>
      <div style={{display:"flex",gap:8}}>
        <input type="text" placeholder="Add ticker… e.g. META, BTC-USD, ^GSPC"
          value={newTicker} onChange={e=>setNewTicker(e.target.value.toUpperCase())}
          onKeyDown={e=>e.key==="Enter"&&handleAdd()}
          style={{flex:1,background:T.bg,border:`1px solid ${T.borderLight}`,borderRadius:8,
            color:T.text,fontSize:13,fontFamily:"monospace",padding:"10px 14px",outline:"none"}}/>
        <button onClick={handleAdd} disabled={adding||!newTicker.trim()}
          style={{background:adding||!newTicker.trim()?T.border:T.accent,
            color:adding||!newTicker.trim()?T.muted:T.isDark?"#07090F":"#fff",
            border:"none",borderRadius:8,padding:"10px 20px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"monospace"}}>
          {adding?"…":"+ Add"}
        </button>
      </div>
      <div style={{fontSize:10,color:T.muted,marginTop:8}}>Supports stocks, ETFs, indices (^GSPC), crypto (BTC-USD), forex (EURUSD=X)</div>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const [portfolio,setPortfolio]=useState(DEFAULT_PORTFOLIO);
  const [priceMap,setPriceMap]=useState({});
  const [benchmarkMap,setBenchmarkMap]=useState({});
  const [loadingTickers,setLoadingTickers]=useState(new Set());
  const [metrics,setMetrics]=useState(null);
  const [tab,setTab]=useState("overview");
  const [range,setRange]=useState("1y");
  const [isDark,setIsDark]=useState(true);
  const [activeBenches,setActiveBenches]=useState(["^GSPC","QQQ"]);
  const [focusBench,setFocusBench]=useState("^GSPC");
  const fetchedRef=useRef(new Set());
  const T=isDark?DARK:LIGHT;

  const fetchTicker=useCallback(async(ticker,r="1y",isBench=false)=>{
    const key=ticker+"_"+r+(isBench?"_b":"");
    if(fetchedRef.current.has(key))return;
    fetchedRef.current.add(key);
    if(!isBench)setLoadingTickers(s=>new Set([...s,ticker]));
    const data=await fetchTickerData(ticker,r);
    if(isBench){setBenchmarkMap(prev=>({...prev,[ticker]:data}));}
    else{
      setPriceMap(prev=>({...prev,[ticker]:data}));
      setPortfolio(prev=>({...prev,[ticker]:{...prev[ticker],name:data.name,days:data.prices.length,currency:data.currency,simulated:data.simulated}}));
      setLoadingTickers(s=>{const n=new Set(s);n.delete(ticker);return n;});
    }
  },[]);

  // Fetch new benchmarks when list changes
  useEffect(()=>{ activeBenches.forEach(b=>fetchTicker(b,range,true)); },[activeBenches]);

  useEffect(()=>{
    fetchedRef.current=new Set(); setPriceMap({}); setBenchmarkMap({});
    Object.keys(portfolio).forEach(t=>fetchTicker(t,range,false));
    activeBenches.forEach(b=>fetchTicker(b,range,true));
  },[range]);

  useEffect(()=>{
    Object.keys(DEFAULT_PORTFOLIO).forEach(t=>fetchTicker(t,range,false));
    activeBenches.forEach(b=>fetchTicker(b,range,true));
  },[]);

  useEffect(()=>{
    const weights={};
    Object.entries(portfolio).forEach(([t,v])=>{ const w=parseFloat(v.weight); if(!isNaN(w)&&w>0&&priceMap[t])weights[t]=w; });
    if(!Object.keys(weights).length||!Object.keys(benchmarkMap).length){setMetrics(null);return;}
    setMetrics(computeMetrics(priceMap,weights,benchmarkMap));
  },[priceMap,portfolio,benchmarkMap]);

  const toggleBenchmark=(ticker)=>{
    setActiveBenches(prev=>{
      if(prev.includes(ticker)){ if(prev.length===1)return prev; return prev.filter(b=>b!==ticker); }
      if(prev.length>=5)return prev;
      return [...prev,ticker];
    });
    if(!activeBenches.includes(ticker)) fetchTicker(ticker,range,true);
  };

  const addCustomBenchmark=(ticker)=>{
    if(activeBenches.includes(ticker)||activeBenches.length>=5)return;
    setActiveBenches(prev=>[...prev,ticker]);
    fetchTicker(ticker,range,true);
  };

  const handleUpdate=async(action,ticker,value)=>{
    if(action==="add"){ setPortfolio(prev=>({...prev,[ticker]:{weight:"10",name:null,days:null,currency:null}})); await fetchTicker(ticker,range,false); }
    else if(action==="remove"){ setPortfolio(prev=>{const n={...prev};delete n[ticker];return n;}); setPriceMap(prev=>{const n={...prev};delete n[ticker];return n;}); fetchedRef.current.delete(ticker+"_"+range); }
    else if(action==="weight"){ setPortfolio(prev=>({...prev,[ticker]:{...prev[ticker],weight:value}})); }
  };

  const totalWeight=Object.values(portfolio).reduce((s,v)=>s+(parseFloat(v.weight)||0),0);
  const isValid=Math.abs(totalWeight-100)<0.01;
  const hasData=metrics!==null;
  const activeTickers=Object.keys(portfolio).filter(t=>priceMap[t]);
  const bm=metrics?.benchmarkMetrics?.[focusBench];

  // Keep focusBench valid
  useEffect(()=>{ if(!activeBenches.includes(focusBench))setFocusBench(activeBenches[0]); },[activeBenches]);

  const TABS=[{id:"overview",label:"Overview"},{id:"benchmark",label:"Benchmark"},{id:"risk",label:"Risk"},{id:"editor",label:"⚙ Portfolio"}];
  const cTip=(props)=><ChartTip {...props} T={T}/>;

  return (
    <div style={{background:T.bg,minHeight:"100vh",color:T.text,fontFamily:"'DM Sans','Segoe UI',sans-serif",transition:"background 0.2s,color 0.2s"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;800&family=DM+Mono:wght@400;500;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        input[type=number]::-webkit-inner-spin-button{opacity:.3}
        input::placeholder{color:${T.muted}}
        ::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-track{background:${T.bg}}::-webkit-scrollbar-thumb{background:${T.border};border-radius:3px}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
      `}</style>

      {/* HEADER */}
      <div style={{background:T.surface,borderBottom:`1px solid ${T.border}`,padding:"0 24px",position:"sticky",top:0,zIndex:200}}>
        <div style={{maxWidth:1200,margin:"0 auto"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",height:56,gap:12}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:28,height:28,borderRadius:7,background:`linear-gradient(135deg,${T.accent},${T.blue})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>◈</div>
              <div>
                <div style={{fontSize:14,fontWeight:800,letterSpacing:"-0.01em",color:T.text}}>Portfolio Analytics</div>
                <div style={{fontSize:9,color:T.muted,fontFamily:"monospace",letterSpacing:"0.1em"}}>LIVE · YAHOO FINANCE</div>
              </div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",justifyContent:"flex-end"}}>
              {loadingTickers.size>0&&<div style={{fontSize:11,color:T.amber,background:T.amber+"18",border:`1px solid ${T.amber}35`,borderRadius:6,padding:"3px 10px",fontFamily:"monospace"}}>⟳ {[...loadingTickers].slice(0,3).join(", ")}{loadingTickers.size>3?"…":""}</div>}
              {hasData&&loadingTickers.size===0&&<div style={{fontSize:11,color:T.accent,background:T.accentDim,border:`1px solid ${T.accent}35`,borderRadius:6,padding:"3px 10px",fontFamily:"monospace"}}>● {activeTickers.length} assets · {metrics.days}d</div>}
              {!isValid&&<div style={{fontSize:11,color:T.red,background:T.red+"18",border:`1px solid ${T.red}35`,borderRadius:6,padding:"3px 10px",fontFamily:"monospace"}}>Σ ≠ 100%</div>}
              {hasData&&<button onClick={()=>exportToPDF(metrics,portfolio,range)} style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:7,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:600,color:T.mutedLight,fontFamily:"monospace"}}>↓ PDF</button>}
              <button onClick={()=>setIsDark(d=>!d)} style={{background:T.surfaceHigh,border:`1px solid ${T.border}`,borderRadius:7,padding:"5px 10px",cursor:"pointer",fontSize:14,lineHeight:1}}>{isDark?"☀️":"🌙"}</button>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",paddingBottom:10,flexWrap:"wrap",gap:8}}>
            <div style={{display:"flex",gap:4}}>
              {TABS.map(t=>(
                <button key={t.id} onClick={()=>setTab(t.id)} style={{background:tab===t.id?T.accent:"transparent",color:tab===t.id?(isDark?"#07090F":"#fff"):T.muted,border:`1px solid ${tab===t.id?T.accent:T.border}`,borderRadius:7,padding:"6px 14px",cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"monospace",transition:"all 0.15s"}}>{t.label}</button>
              ))}
            </div>
            <div style={{display:"flex",gap:3,background:T.bg,borderRadius:8,padding:3,border:`1px solid ${T.border}`}}>
              {RANGES.map(r=>(
                <button key={r.value} onClick={()=>setRange(r.value)} style={{background:range===r.value?T.accent:"transparent",color:range===r.value?(isDark?"#07090F":"#fff"):T.muted,border:"none",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:"monospace",transition:"all 0.15s"}}>{r.label}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{maxWidth:1200,margin:"0 auto",padding:"28px 20px"}}>

        {tab!=="editor"&&!hasData&&(
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"80px 20px",gap:16}}>
            {loadingTickers.size>0?(
              <><div style={{width:40,height:40,border:`3px solid ${T.border}`,borderTopColor:T.accent,borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/><div style={{color:T.muted,fontSize:14}}>Fetching market data…</div></>
            ):(
              <><div style={{fontSize:36}}>📊</div><div style={{color:T.muted,fontSize:14}}>Set weights summing to 100% to see analytics</div><button onClick={()=>setTab("editor")} style={{background:T.accent,color:isDark?"#07090F":"#fff",border:"none",borderRadius:8,padding:"10px 24px",fontSize:13,fontWeight:700,cursor:"pointer"}}>Open Portfolio Editor</button></>
            )}
          </div>
        )}

        {/* ── OVERVIEW ── */}
        {tab==="overview"&&hasData&&(
          <div style={{animation:"fadeIn 0.3s ease",display:"flex",flexDirection:"column",gap:24}}>
            <div style={{background:isDark?`linear-gradient(135deg,${T.accent}12,${T.blue}10)`:`linear-gradient(135deg,${T.accent}18,${T.blue}12)`,border:`1px solid ${T.accent}25`,borderRadius:12,padding:"20px 28px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:16}}>
              <div>
                <div style={{fontSize:11,color:T.muted,marginBottom:4}}>{activeTickers.join(" · ")}</div>
                <div style={{fontSize:30,fontWeight:800,letterSpacing:"-0.02em"}}>
                  <span style={{color:metrics.totalReturn>=0?T.accent:T.red}}>{metrics.totalReturn>=0?"+":""}{metrics.totalReturn.toFixed(2)}%</span>
                  <span style={{fontSize:14,color:T.muted,fontWeight:400,marginLeft:10}}>total return · {metrics.days} trading days</span>
                </div>
              </div>
              <div style={{display:"flex",gap:28}}>
                {[["Sharpe",metrics.sharpe.toFixed(2)],["Sortino",metrics.sortino.toFixed(2)],["Max DD",`-${metrics.maxDD.toFixed(2)}%`]].map(([l,v])=>(
                  <div key={l} style={{textAlign:"center"}}><div style={{fontSize:10,color:T.muted,marginBottom:2}}>{l}</div><div style={{fontSize:20,fontWeight:700,fontFamily:"monospace",color:T.text}}>{v}</div></div>
                ))}
              </div>
            </div>

            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12}}>
              <MetricCard T={T} label="Total Return" value={`${metrics.totalReturn>=0?"+":""}${metrics.totalReturn.toFixed(2)}%`} color={metrics.totalReturn>=0?T.accent:T.red}/>
              <MetricCard T={T} label="Ann. Return" value={`${metrics.annReturn>=0?"+":""}${metrics.annReturn.toFixed(2)}%`} color={T.accent}/>
              <MetricCard T={T} label="Sharpe Ratio" value={metrics.sharpe.toFixed(2)} sub="Annualised" color={T.accent}/>
              <MetricCard T={T} label="Sortino Ratio" value={metrics.sortino.toFixed(2)} sub="Downside adj." color={T.blue}/>
              <MetricCard T={T} label="Calmar Ratio" value={metrics.calmar?metrics.calmar.toFixed(2):"—"} color={T.blue}/>
              <MetricCard T={T} label="Volatility" value={`${metrics.annVol.toFixed(2)}%`} sub="Annualised" color={T.purple}/>
              <MetricCard T={T} label="Max Drawdown" value={`-${metrics.maxDD.toFixed(2)}%`} color={T.red} warn/>
              <MetricCard T={T} label="VaR 95% (1d)" value={`${metrics.var95.toFixed(2)}%`} color={T.amber}/>
            </div>

            {/* Cumulative return with all benchmarks */}
            <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,padding:24}}>
              <div style={{fontSize:12,color:T.muted,fontFamily:"monospace",marginBottom:16}}>CUMULATIVE RETURN vs BENCHMARKS</div>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={metrics.series.filter((_,i)=>i%2===0)}>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.border}/>
                  <XAxis dataKey="date" tick={{fill:T.muted,fontSize:9}} tickCount={6}/>
                  <YAxis tick={{fill:T.muted,fontSize:9}} tickFormatter={v=>`${v}%`}/>
                  <Tooltip content={cTip}/><Legend wrapperStyle={{fontSize:11,color:T.muted}}/><ReferenceLine y={0} stroke={T.border}/>
                  <Line type="monotone" dataKey="portfolio" name="Portfolio" stroke={T.accent} strokeWidth={2.5} dot={false}/>
                  {activeBenches.filter(b=>metrics.series[0]?.[b]!==undefined).map(b=>(
                    <Line key={b} type="monotone" dataKey={b} name={b} stroke={getBenchColor(b,activeBenches)} strokeWidth={1.5} dot={false} strokeDasharray="5 3"/>
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,padding:24}}>
              <div style={{fontSize:12,color:T.muted,fontFamily:"monospace",marginBottom:16}}>DRAWDOWN</div>
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={metrics.drawdownSeries.filter((_,i)=>i%2===0)}>
                  <defs><linearGradient id="ddg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={T.red} stopOpacity={0.4}/><stop offset="95%" stopColor={T.red} stopOpacity={0.02}/></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.border}/><XAxis dataKey="date" tick={{fill:T.muted,fontSize:9}} tickCount={6}/><YAxis tick={{fill:T.muted,fontSize:9}} tickFormatter={v=>`${v}%`}/>
                  <Tooltip content={cTip}/><Area type="monotone" dataKey="drawdown" name="Drawdown" stroke={T.red} fill="url(#ddg)" strokeWidth={1.5} dot={false}/><ReferenceLine y={0} stroke={T.border}/>
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,padding:24}}>
              <div style={{fontSize:12,color:T.muted,fontFamily:"monospace",marginBottom:16}}>PORTFOLIO WEIGHTS</div>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {Object.entries(portfolio).filter(([t])=>priceMap[t]).map(([ticker,info],i)=>{
                  const w=parseFloat(info.weight)||0, color=PALETTE[i%PALETTE.length];
                  return (<div key={ticker}><div style={{display:"flex",justifyContent:"space-between",marginBottom:5,fontSize:12}}><span style={{color,fontWeight:700,fontFamily:"monospace"}}>{ticker}</span><span style={{color:T.mutedLight,fontFamily:"monospace"}}>{w.toFixed(1)}%</span></div><div style={{height:5,background:T.border,borderRadius:3}}><div style={{width:`${Math.min(w,100)}%`,height:"100%",background:color,borderRadius:3,transition:"width 0.4s"}}/></div></div>);
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── BENCHMARK ── */}
        {tab==="benchmark"&&hasData&&(
          <div style={{animation:"fadeIn 0.3s ease",display:"flex",flexDirection:"column",gap:24}}>
            <BenchmarkSelector activeBenches={activeBenches} onToggle={toggleBenchmark} onAddCustom={addCustomBenchmark} T={T}/>

            {/* Focus selector for detailed metrics */}
            {activeBenches.length>1&&(
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <span style={{fontSize:11,color:T.muted,fontFamily:"monospace"}}>DETAILED ANALYSIS FOR:</span>
                {activeBenches.map(b=>(
                  <button key={b} onClick={()=>setFocusBench(b)} style={{background:focusBench===b?getBenchColor(b,activeBenches)+"20":T.surface,color:getBenchColor(b,activeBenches),border:`1px solid ${getBenchColor(b,activeBenches)}50`,borderRadius:7,padding:"5px 14px",cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:"monospace",transition:"all 0.15s"}}>{b}</button>
                ))}
              </div>
            )}

            {/* Multi-benchmark comparison table */}
            {activeBenches.length>1&&(
              <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,padding:24}}>
                <div style={{fontSize:12,color:T.muted,fontFamily:"monospace",marginBottom:16}}>BENCHMARK COMPARISON</div>
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,fontFamily:"monospace"}}>
                    <thead><tr style={{borderBottom:`1px solid ${T.border}`}}>
                      {["Benchmark","Beta","Alpha (ann.)","Track. Error","Info. Ratio","Correlation"].map(h=>(
                        <th key={h} style={{padding:"8px 12px",color:T.muted,textAlign:h==="Benchmark"?"left":"right",fontWeight:600}}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {activeBenches.map(b=>{
                        const m=metrics.benchmarkMetrics?.[b]; if(!m)return null;
                        const color=getBenchColor(b,activeBenches);
                        return (
                          <tr key={b} style={{borderBottom:`1px solid ${T.border}`,cursor:"pointer",background:focusBench===b?T.bg:"transparent"}} onClick={()=>setFocusBench(b)}>
                            <td style={{padding:"10px 12px"}}><div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:8,height:8,borderRadius:"50%",background:color}}/><span style={{color,fontWeight:700}}>{b}</span></div></td>
                            <td style={{padding:"10px 12px",color:Math.abs(m.beta-1)<0.2?T.text:m.beta>1?T.red:T.accent,textAlign:"right"}}>{m.beta.toFixed(3)}</td>
                            <td style={{padding:"10px 12px",color:m.alpha>=0?T.accent:T.red,textAlign:"right"}}>{m.alpha>=0?"+":""}{m.alpha.toFixed(2)}%</td>
                            <td style={{padding:"10px 12px",color:T.purple,textAlign:"right"}}>{m.te.toFixed(2)}%</td>
                            <td style={{padding:"10px 12px",color:m.ir>=0.5?T.accent:m.ir>=0?T.amber:T.red,textAlign:"right"}}>{m.ir.toFixed(2)}</td>
                            <td style={{padding:"10px 12px",color:T.blue,textAlign:"right"}}>{m.corr.toFixed(3)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {bm&&(
              <>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12}}>
                  <MetricCard T={T} label="Beta" value={bm.beta.toFixed(3)} sub={`vs ${focusBench}`} color={T.blue}/>
                  <MetricCard T={T} label="Alpha (ann.)" value={`${bm.alpha>=0?"+":""}${bm.alpha.toFixed(2)}%`} sub="Jensen's alpha" color={bm.alpha>=0?T.accent:T.red}/>
                  <MetricCard T={T} label="Tracking Error" value={`${bm.te.toFixed(2)}%`} sub="Annualised" color={T.purple}/>
                  <MetricCard T={T} label="Info. Ratio" value={bm.ir.toFixed(2)} sub="Active return / TE" color={bm.ir>=0.5?T.accent:T.amber}/>
                  <MetricCard T={T} label="Correlation" value={bm.corr.toFixed(3)} sub={`with ${focusBench}`} color={T.blue}/>
                </div>

                <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,padding:24}}>
                  <div style={{fontSize:12,color:T.muted,fontFamily:"monospace",marginBottom:16}}>INTERPRETATION vs {focusBench}</div>
                  <div style={{display:"flex",flexDirection:"column",gap:10}}>
                    {[
                      {label:"Beta",value:bm.beta,color:Math.abs(bm.beta-1)<0.2?T.amber:bm.beta>1.2?T.red:T.accent,text:bm.beta>1.2?`High beta (${bm.beta.toFixed(2)}) — portfolio is ${((bm.beta-1)*100).toFixed(0)}% more volatile than ${focusBench}`:bm.beta<0.8?`Low beta (${bm.beta.toFixed(2)}) — defensive, less sensitive to market moves`:`Market-neutral beta (${bm.beta.toFixed(2)}) — broadly aligned with ${focusBench}`},
                      {label:"Alpha",value:bm.alpha,color:bm.alpha>0?T.accent:T.red,text:bm.alpha>0?`Generating +${bm.alpha.toFixed(2)}% annualised excess return above market risk — positive alpha`:`Underperforming by ${Math.abs(bm.alpha).toFixed(2)}% after adjusting for market risk`},
                      {label:"Info. Ratio",value:bm.ir,color:bm.ir>=0.5?T.accent:bm.ir>=0?T.amber:T.red,text:bm.ir>=0.5?`Strong IR (${bm.ir.toFixed(2)}) — active bets are consistently rewarded`:bm.ir>=0?`Modest IR (${bm.ir.toFixed(2)}) — some active value but inconsistent`:`Negative IR (${bm.ir.toFixed(2)}) — active positions are destroying value vs passive ${focusBench}`},
                    ].map(({label,value,color,text})=>(
                      <div key={label} style={{display:"flex",alignItems:"flex-start",gap:12,padding:"12px 16px",background:T.bg,borderRadius:8,border:`1px solid ${T.borderLight}`}}>
                        <div style={{width:8,height:8,borderRadius:"50%",background:color,marginTop:4,flexShrink:0}}/>
                        <div><span style={{color:T.mutedLight,fontSize:11,fontFamily:"monospace"}}>{label}: </span><span style={{color:T.text,fontSize:12}}>{text}</span></div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,padding:24}}>
                  <div style={{fontSize:12,color:T.muted,fontFamily:"monospace",marginBottom:16}}>PORTFOLIO vs ALL BENCHMARKS</div>
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={metrics.series.filter((_,i)=>i%2===0)}>
                      <CartesianGrid strokeDasharray="3 3" stroke={T.border}/><XAxis dataKey="date" tick={{fill:T.muted,fontSize:9}} tickCount={6}/><YAxis tick={{fill:T.muted,fontSize:9}} tickFormatter={v=>`${v}%`}/>
                      <Tooltip content={cTip}/><Legend wrapperStyle={{fontSize:11}}/><ReferenceLine y={0} stroke={T.border}/>
                      <Line type="monotone" dataKey="portfolio" name="Portfolio" stroke={T.accent} strokeWidth={2.5} dot={false}/>
                      {activeBenches.map(b=><Line key={b} type="monotone" dataKey={b} name={b} stroke={getBenchColor(b,activeBenches)} strokeWidth={1.5} dot={false} strokeDasharray="5 3"/>)}
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,padding:24}}>
                  <div style={{fontSize:12,color:T.muted,fontFamily:"monospace",marginBottom:16}}>ACTIVE RETURN (PORTFOLIO − {focusBench})</div>
                  <ResponsiveContainer width="100%" height={180}>
                    <AreaChart data={metrics.series.filter((_,i)=>i%2===0).map(d=>({date:d.date,active:+((d.portfolio-(d[focusBench]??0))).toFixed(2)}))}>
                      <defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={T.accent} stopOpacity={0.3}/><stop offset="95%" stopColor={T.accent} stopOpacity={0}/></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={T.border}/><XAxis dataKey="date" tick={{fill:T.muted,fontSize:9}} tickCount={6}/><YAxis tick={{fill:T.muted,fontSize:9}} tickFormatter={v=>`${v}%`}/>
                      <Tooltip content={cTip}/><ReferenceLine y={0} stroke={T.mutedLight} strokeDasharray="4 2"/>
                      <Area type="monotone" dataKey="active" name="Active Return" stroke={T.accent} fill="url(#ag)" strokeWidth={1.5} dot={false}/>
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── RISK ── */}
        {tab==="risk"&&hasData&&(
          <div style={{animation:"fadeIn 0.3s ease",display:"flex",flexDirection:"column",gap:24}}>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12}}>
              <MetricCard T={T} label="VaR 95% (1d)" value={`${metrics.var95.toFixed(2)}%`} color={T.amber}/>
              <MetricCard T={T} label="Exp. Shortfall" value={`${metrics.es95.toFixed(2)}%`} sub="CVaR 95%" color={T.red}/>
              <MetricCard T={T} label="Volatility" value={`${metrics.annVol.toFixed(2)}%`} color={T.purple}/>
              <MetricCard T={T} label="Max Drawdown" value={`-${metrics.maxDD.toFixed(2)}%`} color={T.red} warn/>
              <MetricCard T={T} label="Sortino Ratio" value={metrics.sortino.toFixed(2)} color={T.blue}/>
              <MetricCard T={T} label="Calmar Ratio" value={metrics.calmar?metrics.calmar.toFixed(2):"—"} color={T.blue}/>
            </div>
            <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,padding:24}}>
              <div style={{fontSize:12,color:T.muted,fontFamily:"monospace",marginBottom:16}}>ROLLING 20-DAY VOLATILITY (ANN.)</div>
              <ResponsiveContainer width="100%" height={210}>
                <LineChart data={metrics.rollingVol.filter(d=>d.vol!==null).filter((_,i)=>i%2===0)}>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.border}/><XAxis dataKey="date" tick={{fill:T.muted,fontSize:9}} tickCount={6}/><YAxis tick={{fill:T.muted,fontSize:9}} tickFormatter={v=>`${v}%`}/>
                  <Tooltip content={cTip}/><Line type="monotone" dataKey="vol" name="Volatility" stroke={T.purple} strokeWidth={2} dot={false}/>
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,padding:24}}>
              <div style={{fontSize:12,color:T.muted,fontFamily:"monospace",marginBottom:16}}>DAILY RETURN DISTRIBUTION</div>
              <ResponsiveContainer width="100%" height={190}>
                <BarChart data={metrics.bins}>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.border}/><XAxis dataKey="range" tick={{fill:T.muted,fontSize:9}} tickFormatter={v=>`${v}%`}/><YAxis tick={{fill:T.muted,fontSize:9}}/>
                  <Tooltip content={cTip}/><Bar dataKey="count" name="Days" fill={T.blue} radius={[3,3,0,0]}/><ReferenceLine x={metrics.var95.toFixed(1)} stroke={T.red} strokeDasharray="4 2"/>
                </BarChart>
              </ResponsiveContainer>
              <div style={{fontSize:11,color:T.muted,marginTop:8}}>Red line = VaR 95% threshold ({metrics.var95.toFixed(2)}%)</div>
            </div>
            <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,padding:24}}>
              <div style={{fontSize:12,color:T.muted,fontFamily:"monospace",marginBottom:16}}>INDIVIDUAL ASSET RISK</div>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,fontFamily:"monospace"}}>
                  <thead><tr style={{borderBottom:`1px solid ${T.border}`}}>
                    {["Ticker","Weight","Return","Volatility","Sharpe"].map(h=>(
                      <th key={h} style={{padding:"8px 12px",color:T.muted,textAlign:h==="Ticker"?"left":"right",fontWeight:600}}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {activeTickers.map((ticker,i)=>{
                      const prices=priceMap[ticker]?.prices??[]; if(prices.length<2)return null;
                      const rets=prices.map((d,j)=>j===0?0:(d.price-prices[j-1].price)/prices[j-1].price).slice(1);
                      const mn=rets.reduce((a,b)=>a+b,0)/rets.length;
                      const sd=Math.sqrt(rets.reduce((a,b)=>a+(b-mn)**2,0)/(rets.length-1));
                      const totalRet=(prices[prices.length-1].price/prices[0].price-1)*100;
                      const sh=(mn/sd)*Math.sqrt(252), color=PALETTE[i%PALETTE.length];
                      return (
                        <tr key={ticker} style={{borderBottom:`1px solid ${T.border}`}}>
                          <td style={{padding:"10px 12px",color,fontWeight:700}}>{ticker}</td>
                          <td style={{padding:"10px 12px",color:T.mutedLight,textAlign:"right"}}>{portfolio[ticker]?.weight}%</td>
                          <td style={{padding:"10px 12px",color:totalRet>=0?T.accent:T.red,textAlign:"right"}}>{totalRet>=0?"+":""}{totalRet.toFixed(1)}%</td>
                          <td style={{padding:"10px 12px",color:T.purple,textAlign:"right"}}>{(sd*Math.sqrt(252)*100).toFixed(1)}%</td>
                          <td style={{padding:"10px 12px",color:sh>=1?T.accent:sh>=0?T.amber:T.red,textAlign:"right"}}>{sh.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── EDITOR ── */}
        {tab==="editor"&&(
          <div style={{animation:"fadeIn 0.3s ease",display:"flex",flexDirection:"column",gap:20}}>
            <PortfolioEditor portfolio={portfolio} onUpdate={handleUpdate} loadingTickers={loadingTickers} T={T}/>
            {activeTickers.length>1&&(
              <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:12,padding:24}}>
                <div style={{fontSize:12,color:T.muted,fontFamily:"monospace",marginBottom:16}}>INDIVIDUAL PRICE PERFORMANCE</div>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart>
                    <CartesianGrid strokeDasharray="3 3" stroke={T.border}/><XAxis dataKey="date" tick={{fill:T.muted,fontSize:9}} tickCount={5} allowDuplicatedCategory={false}/><YAxis tick={{fill:T.muted,fontSize:9}} tickFormatter={v=>`${v}%`}/>
                    <Tooltip content={cTip}/><Legend wrapperStyle={{fontSize:11,color:T.muted}}/>
                    {activeTickers.map((ticker,i)=>{
                      const prices=priceMap[ticker]?.prices??[], p0=prices[0]?.price??1;
                      const data=prices.map(d=>({date:d.date,[ticker]:+((d.price/p0-1)*100).toFixed(2)}));
                      return <Line key={ticker} data={data} type="monotone" dataKey={ticker} stroke={PALETTE[i%PALETTE.length]} strokeWidth={1.5} dot={false}/>;
                    })}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
