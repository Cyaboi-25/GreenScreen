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

## Deploy to Cloudflare Pages

The API key is proxied through a Cloudflare Pages Function at `functions/api/scan.js`,
so it stays server-side.

1. Push this repo to GitHub.
2. In the Cloudflare dashboard: **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → select this repo.
3. Build settings:
   - **Framework preset:** Vite
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
4. After the first deploy, go to **Settings** → **Environment variables** → add a **Production** variable:
   - Name: `ANTHROPIC_KEY`
   - Value: your `sk-ant-...` key
   - Mark it as **Encrypt** (secret)
5. Redeploy. Open the live URL on your phone, upload a lawn photo, and scan.
