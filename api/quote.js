// api/quote.js — Vercel Serverless Function
// Fetches real price data from Yahoo Finance with proper crumb/cookie auth

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { ticker, range = "1y", interval = "1d" } = req.query;
  if (!ticker) return res.status(400).json({ error: "Missing ticker" });

  const HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Origin": "https://finance.yahoo.com",
    "Referer": "https://finance.yahoo.com/",
  };

  try {
    // Step 1: Get a valid session cookie + crumb from Yahoo Finance
    const cookieRes = await fetch("https://finance.yahoo.com/", {
      headers: HEADERS,
      redirect: "follow",
    });

    const rawCookies = cookieRes.headers.get("set-cookie") || "";
    // Extract all cookie key=value pairs and join them
    const cookieString = rawCookies
      .split(/,(?=[^;]+=[^;])/)
      .map(c => c.split(";")[0].trim())
      .join("; ");

    // Step 2: Fetch the crumb using the session cookie
    const crumbRes = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", {
      headers: { ...HEADERS, "Cookie": cookieString },
    });
    const crumb = await crumbRes.text();

    if (!crumb || crumb.includes("error") || crumb.length > 20) {
      // Crumb failed — try v7 API which sometimes works without crumb
      return await tryV7(ticker, range, interval, cookieString, HEADERS, res);
    }

    // Step 3: Fetch actual price data with crumb + cookie
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=${range}&interval=${interval}&includePrePost=false&crumb=${encodeURIComponent(crumb)}`;

    const dataRes = await fetch(url, {
      headers: { ...HEADERS, "Cookie": cookieString },
    });

    if (!dataRes.ok) {
      return await tryV7(ticker, range, interval, cookieString, HEADERS, res);
    }

    const data = await dataRes.json();
    return parseAndRespond(data, ticker, res);

  } catch (err) {
    return res.status(500).json({ error: "Fetch failed: " + err.message });
  }
}

// Fallback: try Yahoo Finance v7 download endpoint (CSV-style)
async function tryV7(ticker, range, interval, cookieString, HEADERS, res) {
  try {
    // Convert range to period1/period2 timestamps
    const now = Math.floor(Date.now() / 1000);
    const rangeMap = {
      "1mo": 30, "3mo": 90, "6mo": 180, "1y": 365,
      "2y": 730, "5y": 1825, "max": 7300,
    };
    const days = rangeMap[range] || 365;
    const period1 = now - days * 86400;

    const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?period1=${period1}&period2=${now}&interval=${interval}&includePrePost=false`;

    const dataRes = await fetch(url, {
      headers: {
        ...HEADERS,
        "Cookie": cookieString || "",
      },
    });

    if (!dataRes.ok) {
      return res.status(dataRes.status).json({ error: `Yahoo Finance returned ${dataRes.status} for ${ticker}` });
    }

    const data = await dataRes.json();
    return parseAndRespond(data, ticker, res);
  } catch (err) {
    return res.status(500).json({ error: "v7 fallback failed: " + err.message });
  }
}

function parseAndRespond(data, ticker, res) {
  const result = data?.chart?.result?.[0];
  if (!result) {
    return res.status(404).json({ error: `No data for ${ticker}` });
  }

  const timestamps = result.timestamp || [];
  const closes = result.indicators?.quote?.[0]?.close || [];
  const meta = result.meta || {};

  const prices = timestamps
    .map((ts, i) => ({
      date: new Date(ts * 1000).toISOString().slice(0, 10),
      price: closes[i] ?? null,
    }))
    .filter(d => d.price !== null && isFinite(d.price) && d.price > 0);

  if (prices.length < 5) {
    return res.status(422).json({ error: `Insufficient data for ${ticker} (${prices.length} points)` });
  }

  return res.status(200).json({
    ticker: ticker.toUpperCase(),
    name: meta.shortName || meta.longName || ticker,
    currency: meta.currency || "USD",
    exchange: meta.exchangeName || "",
    prices,
  });
}
