# Charity Week Auction Dinner 2026 - Financial Simulator

Interactive financial modelling tool for Imperial College ISoc's Charity Week Auction Dinner.

## Deploy to Vercel (easiest - 2 minutes)

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Create a new GitHub repo and push this folder to it:
   ```bash
   cd cw-simulator
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/cw-simulator.git
   git push -u origin main
   ```
3. On Vercel, click "Add New Project" and import your repo
4. Vercel auto-detects Vite - just click Deploy
5. Done. You get a URL like `cw-simulator.vercel.app`

## Deploy to Netlify (drag and drop)

1. Run the build locally first:
   ```bash
   npm install
   npm run build
   ```
2. Go to [app.netlify.com/drop](https://app.netlify.com/drop)
3. Drag the `dist` folder onto the page
4. Done. You get a URL immediately.

## Run locally

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`

## Tech stack

- React 18
- Vite
- Tailwind CSS
- Recharts
