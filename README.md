# Fitness

Personal workout tracker PWA. Self-hosted on Unraid via Docker.

Built around a fixed 4-day muscle-group split (Mon Chest+Tri / Tue Back+Bi / Thu Legs / Fri Shoulders+Core). Designed to be used **during** the gym session — not just a logger.

## Features

- **Calendar** with completion ticks
- **Guided workout flow** — walks you through exercises in order
- **Per-set logging** with weight + reps
- **Rest timer** — exercise-specific 45/60/90s, sound + vibrate when done
- **Inline form cues** from the plan ("don't lock elbows", "don't go super deep with left knee")
- **Suggested next weight** — auto-bumps the pin if you hit top of rep range with "felt easy"
- **Per-exercise progression view** with line chart
- **Bodyweight + waist log** with 90-day chart
- **Progress photos** — gallery + side-by-side comparison
- **Network-resilient** — sets queue locally and retry on transient failures

## Stack

- SvelteKit + TypeScript (Node adapter)
- SQLite via better-sqlite3 + Drizzle ORM
- Chart.js for charts
- vite-plugin-pwa for installability + service worker
- Single Docker container, no external deps

## Deploy on Unraid

### One-time setup

1. **Add the container.** In Unraid, *Docker* → *Add Container* → paste the template URL:
   ```
   https://raw.githubusercontent.com/asim2202/fitness/main/unraid-template.xml
   ```
   Or fill in manually:
   - Repository: `ghcr.io/asim2202/fitness:latest`
   - Web UI port: `3000:3000`
   - Volume: `/mnt/user/appdata/fitness/` → `/app/data`
   - Env: `TZ=Asia/Dubai`

2. **Verify.** Hit `http://<unraid-ip>:3000` — you should see the calendar.

3. **Reverse proxy via Nginx Proxy Manager (NPM):**
   - Add proxy host: `fitness.yourdomain.com` → `unraid-host:3000`
   - Enable WebSocket support and "Block common exploits"
   - Request a Let's Encrypt cert (HTTPS is **required** for the PWA install prompt to appear)

4. **Install the PWA on your phone:**
   - Open `https://fitness.yourdomain.com` in Chrome on Android
   - Menu → "Install app" (or "Add to home screen")
   - Launches full-screen from the home screen icon

### Updating

Manual, predictable — won't update mid-workout:

```bash
docker compose pull
docker compose up -d
```

Or in Unraid UI: open the container → "Force Update".

Migrations run automatically on container start. Existing data is preserved.

## Local development

```bash
npm install
npm run dev
```

Opens on `http://localhost:5173`. SQLite database lives at `./data/fitness.db` (gitignored).

```bash
npm run check     # type-check + svelte-check
npm run build     # production build
npm start         # run the production build
```

To regenerate Drizzle migrations after schema changes:

```bash
npx drizzle-kit generate --name=<short-name>
```

To regenerate the PWA icons:

```bash
node scripts/gen-icons.mjs
```

## Backup

Just back up the data volume — that's the entire app state:

```
/mnt/user/appdata/fitness/
  ├── fitness.db        # SQLite database
  └── photos/           # progress photo files
```

## License

Personal project — not licensed for redistribution.
