# LawnScan 🌿

AI-powered lawn diagnostic tool. Upload a photo of your lawn and get:
- Health score (1-10) with grass type identification
- Issue detection (weeds, disease, bare spots, compaction, etc.)
- Severity ratings and affected area estimates
- Phased restoration plan with timeframes and product recommendations
- Quick wins you can act on today

## Tech Stack
- React + Vite
- Anthropic Claude API (vision/multimodal)

## Run Locally
```bash
npm install
npm run dev
```

## Important: API Key Security
The current MVP calls the Anthropic API directly from the browser.
For production, add a backend proxy (Cloudflare Worker or Express server)
to keep API keys server-side.
