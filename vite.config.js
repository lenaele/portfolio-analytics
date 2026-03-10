import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy /api calls to Yahoo Finance directly when running locally
      '/api/quote': {
        target: 'https://query1.finance.yahoo.com',
        changeOrigin: true,
        rewrite: (path) => {
          const url = new URL(path, 'http://localhost')
          const ticker = url.searchParams.get('ticker')
          return `/v8/finance/chart/${ticker}?range=1y&interval=1d&includePrePost=false`
        },
      },
    },
  },
})
