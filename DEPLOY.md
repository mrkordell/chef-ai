# Deploying Chef AI to Railway

## Prerequisites

- A [Railway](https://railway.app) account (GitHub-linked is easiest)
- An [OpenRouter](https://openrouter.ai) API key with credits
- (Optional) [Railway CLI](https://docs.railway.app/guides/cli) for running one-off commands

## Deployment Files

The repo already includes the files needed for containerized deployment:

- **`Dockerfile`** — Single-stage build on `oven/bun:1`. Installs dependencies, builds the frontend (Tailwind CSS + Bun bundler), creates the `/app/data` directory for SQLite, and starts the server via `bun run start` (`NODE_ENV=production bun run index.ts`).
- **`.dockerignore`** — Keeps the build context clean.
- **`railway.json`** — Railway-specific configuration.

You should not need to modify these for a standard Railway deployment.

## 1. Railway Setup

### Create the project

1. Go to [railway.app/new](https://railway.app/new)
2. Choose **Deploy from GitHub repo** and select the `chef-ai` repository
3. Railway will detect the Dockerfile automatically

### Add a persistent volume

**This is critical.** SQLite stores data on disk. Without a volume, every deploy wipes the database.

1. In your service settings, go to **Volumes**
2. Add a volume with mount path: `/app/data`
3. The app writes the database to `/app/data/chef.db` by default (matching `DATABASE_PATH`)

### Set environment variables

In the Railway service **Variables** tab, add:

| Variable | Value |
|---|---|
| `OPENROUTER_API_KEY` | Your OpenRouter API key |
| `JWT_SECRET` | A random string, **minimum 32 characters** |
| `NODE_ENV` | `production` |
| `CORS_ORIGIN` | `https://<your-app>.up.railway.app` (set after first deploy) |

Optional overrides (defaults are fine for most setups):

| Variable | Default | Notes |
|---|---|---|
| `AI_MODEL` | `anthropic/claude-sonnet-4` | Any [OpenRouter model ID](https://openrouter.ai/models) |
| `PORT` | `3000` | Railway injects `PORT` automatically; no need to set this |
| `DATABASE_PATH` | `./data/chef.db` | Change only if your volume mount differs |

> **Startup validation:** The app validates all env vars via Zod on boot. If a required variable is missing or `JWT_SECRET` is under 32 characters, the process exits immediately with a clear error in the deploy logs.

### Set CORS_ORIGIN

After the first deploy, Railway assigns a public URL (e.g. `https://chef-ai-production.up.railway.app`). Copy it and set:

```
CORS_ORIGIN=https://chef-ai-production.up.railway.app
```

This must match exactly (no trailing slash). The app uses this for the Hono CORS middleware.

## 2. Database Migrations

The app auto-creates the `data/` directory on startup via `mkdirSync`, so the volume mount will work immediately.

However, the database **schema** needs to be applied. On the first deploy (or after schema changes), push the schema using the Railway CLI:

```sh
railway run bun run db:push
```

`db:push` uses Drizzle Kit to apply the schema directly. For migration-file-based workflows:

```sh
railway run bun run db:generate   # generate migration SQL
railway run bun run db:migrate    # apply migration files from ./drizzle
```

> If you don't have the Railway CLI, you can add a one-time start command in Railway's service settings or use the Railway shell feature from the dashboard.

## 3. Deployment Workflow

Once connected, deploys are automatic:

```
push to main  -->  Railway builds Dockerfile  -->  deploys new container
```

**What happens during a build:**
1. Dependencies installed (`bun install --frozen-lockfile`)
2. Frontend built to `./dist` (Tailwind CSS + Bun bundler)
3. Container starts with `bun run start` (`NODE_ENV=production bun run index.ts`)

**Health check:** Configure Railway's health check to poll:

```
GET /api/health
```

Returns `200 { status: "ok" }` when the server and database are healthy, or `503` if the database is unreachable.

**Graceful shutdown:** The app listens for `SIGTERM` (sent by Railway on redeploy), closes the HTTP server, and flushes the SQLite WAL before exiting.

## 4. Monitoring & Debugging

- **Logs:** Railway dashboard > your service > **Logs** tab (or `railway logs` via CLI)
- **Health:** Hit `https://<your-app>.up.railway.app/api/health` to check server + DB status
- **Common issues:**

| Symptom | Likely cause |
|---|---|
| App crashes on startup | Missing or invalid env var. Check logs for the Zod validation error. |
| `503` from health check | Database file missing or corrupt. Verify the volume is mounted at `/app/data`. |
| CORS errors in browser | `CORS_ORIGIN` doesn't match the actual URL (check protocol, no trailing slash). |
| Data lost after redeploy | Volume not attached. Add one mounted at `/app/data`. |

## 5. Cost Estimate

Railway [pricing](https://railway.app/pricing) as of early 2026:

| Component | Cost |
|---|---|
| Hobby plan base | ~$5/mo |
| Compute (low-traffic app) | ~$1-3/mo usage |
| Volume (1 GB) | $0.25/mo |
| **Estimated total** | **Under $10/mo for light use** |

OpenRouter costs are separate and depend on model choice and usage volume.

## 6. Local Docker Testing (Optional)

Test the production build locally before pushing:

```sh
# Build the image
docker build -t chef-ai .

# Run with a local volume for the database
docker run --rm -it \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  -e OPENROUTER_API_KEY="your-key" \
  -e JWT_SECRET="your-secret-at-least-32-characters-long" \
  -e NODE_ENV=production \
  -e CORS_ORIGIN=http://localhost:3000 \
  chef-ai
```

Then open [http://localhost:3000](http://localhost:3000) and verify the app loads and `/api/health` returns `ok`.

Run migrations against the local container:

```sh
docker exec -it <container-id> bun run db:push
```
