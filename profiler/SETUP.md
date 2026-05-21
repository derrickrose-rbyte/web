# Setup — run this tomorrow on Claude Desktop

## 1. Clone the repo and go to the profiler folder

```bash
git clone https://github.com/derrickrose-rbyte/web.git
cd web/profiler
```

## 2. Install dependencies

```bash
npm install
```

## 3. Create your .env.local file

```bash
cp .env.local.example .env.local
```

Then open `.env.local` and fill in:

| Variable | Where to get it |
|---|---|
| `ANTHROPIC_API_KEY` | console.anthropic.com -> API Keys |
| `RESEND_API_KEY` | resend.com -> API Keys (free tier covers 3k emails/month) |
| `RESEND_FROM_EMAIL` | A domain you've verified in Resend, e.g. `audit@yourdomain.com` |
| `NEXT_PUBLIC_BOOKING_URL` | Your cal.com or Calendly booking link |
| `ANALYTICS_PASSWORD` | Any password you choose — used to access /analytics |

## 4. Run locally

```bash
npm run dev
```

Open http://localhost:3000 to see the landing page.
Open http://localhost:3000/analytics to see your leads (enter your ANALYTICS_PASSWORD).

## 5. Deploy to Vercel (when ready)

```bash
npx vercel --prod
```

Or connect the repo at vercel.com and add the env vars in the dashboard.

**Note:** The analytics log writes to /tmp/profiler-analytics.json.
On Vercel this resets on cold starts (roughly every few hours with no traffic).
For a permanent log, swap lib/analytics.ts to use Vercel KV or a simple database later.
For early-stage use (first 50-100 leads) the current setup is fine.
