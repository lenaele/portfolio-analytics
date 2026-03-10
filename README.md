# 📊 Portfolio Analytics Dashboard

A full-stack quantitative finance web application for real-time portfolio analysis, risk metrics, and portfolio optimization. Built with React and powered by live market data from Yahoo Finance.

🔗 **Live Demo:** [https://portfolio-analytics-git-main-lenaeles-projects.vercel.app/](https://your-link.vercel.app)

---

## 🖥️ Features

### Module 1 — Data Pipeline
- Fetches real-time price data from **Yahoo Finance API**
- Supports any ticker: stocks, ETFs, indices (`^GSPC`), crypto (`BTC-USD`), forex (`EURUSD=X`)
- Serverless backend proxy (Vercel Functions) to handle CORS and API routing
- Automatic fallback to realistic GBM simulation if data is unavailable

### Module 2 — Portfolio Engine
- **Custom portfolio builder** — add/remove any ticker, set weights manually
- Real-time weight validation (must sum to 100%)
- Cumulative return vs benchmark
- Drawdown analysis
- Adjustable **time period**: 1M · 3M · 6M · 1Y · 2Y · 5Y · Max

### Module 3 — Risk Analytics
- **Value at Risk (VaR)** — 95% historical simulation
- **Expected Shortfall (CVaR)** — tail risk beyond VaR
- **Rolling 20-day Volatility** — annualised
- **Daily Return Distribution** — with VaR threshold marker
- **Correlation Matrix** — heatmap across all assets
- **Fama–French Factor Exposures** — Market β, SMB, HML, Momentum

### Module 4 — Portfolio Optimization
- **Efficient Frontier** — Modern Portfolio Theory
- **Minimum Variance Portfolio**
- **Maximum Sharpe Portfolio**
- **Monte Carlo Simulation** — 1000 paths, 1-year horizon
- Side-by-side comparison of current vs optimal portfolios

### Module 5 — Dashboard
- Clean, dark-themed UI built with React + Recharts
- Fully responsive
- All charts and metrics update live when weights or time period change

---

## 📐 Key Metrics Computed

| Metric | Description |
|---|---|
| Total Return | Cumulative portfolio return over selected period |
| Sharpe Ratio | Annualised risk-adjusted return (excess return / volatility) |
| Sortino Ratio | Like Sharpe but only penalises downside volatility |
| Volatility | Annualised standard deviation of daily returns |
| Max Drawdown | Largest peak-to-trough decline in the period |
| VaR 95% | Worst expected daily loss 95% of the time |
| Expected Shortfall | Average loss in the worst 5% of days |
| Beta | Portfolio sensitivity to the market (vs SPY) |

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Recharts, Vite |
| Backend | Vercel Serverless Functions (Node.js) |
| Data Source | Yahoo Finance API (`yfinance` compatible) |
| Deployment | Vercel (CI/CD via GitHub) |
| Version Control | Git + GitHub |

---

## 🗂️ Project Structure

```
portfolio-analytics/
│
├── api/
│   └── quote.js          # Serverless function — Yahoo Finance proxy
│
├── src/
│   ├── App.jsx           # Main React app (all 5 modules)
│   └── main.jsx          # Entry point
│
├── index.html
├── vite.config.js        # Dev proxy config
├── package.json
└── README.md
```

---

## 🚀 Run Locally

```bash
# 1. Clone the repository
git clone https://github.com/lenaele/portfolio-analytics.git
cd portfolio-analytics

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 📦 Deploy to Vercel

```bash
npm install -g vercel
vercel
```

Vercel automatically detects the `api/` folder and deploys the serverless function alongside the frontend.

---

## 📈 Example Usage

1. Open the **⚙ Portfolio** tab
2. Add any tickers (e.g. `AAPL`, `MSFT`, `BTC-USD`, `^GSPC`)
3. Set weights that sum to 100%
4. Select a time period (1M to Max)
5. Switch to **Overview** or **Risk** tab to see live analytics

---

## 💡 Financial Models Used

**Sharpe Ratio**
```
S = (Rp - Rf) / σp × √252
```

**Sortino Ratio**
```
Sortino = (Rp - Rf) / σd × √252
where σd = downside deviation (negative returns only)
```

**Value at Risk (Historical)**
```
VaR(95%) = 5th percentile of daily return distribution
```

**Expected Shortfall**
```
ES = mean of all returns below VaR threshold
```

**Maximum Drawdown**
```
MDD = max(Peak - Trough) / Peak over selected period
```

---

## 👩‍💻 Author

**Elena** — [@lenaele](https://github.com/lenaele)

---

## 📄 License

MIT License — free to use and modify.
