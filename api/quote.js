// api/quote.js — Vercel Serverless Function
// Proxies Yahoo Finance requests server-side, avoiding CORS issues

export default async function handler(req, res) {
  // Allow requests from any origin
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { ticker, range = "1y", interval = "1d" } = req.query;

  if (!ticker) {
    return res.status(400).json({ error: "Missing ticker parameter" });
  }

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=${range}&interval=${interval}&includePrePost=false`;

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `Yahoo Finance returned ${response.status}` });
    }

    const data = await response.json();
    const result = data?.chart?.result?.[0];

    if (!result) {
      return res.status(404).json({ error: "No data found for ticker: " + ticker });
    }

    const timestamps = result.timestamp;
    const closes = result.indicators.quote[0].close;
    const meta = result.meta;

    const prices = timestamps
      .map((ts, i) => ({
        date: new Date(ts * 1000).toISOString().slice(0, 10),
        price: closes[i] ?? null,
      }))
      .filter((d) => d.price !== null && isFinite(d.price));

    return res.status(200).json({
      ticker: ticker.toUpperCase(),
      name: meta.shortName || ticker,
      currency: meta.currency || "USD",
      prices,
    });

  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch from Yahoo Finance: " + err.message });
  }
}
