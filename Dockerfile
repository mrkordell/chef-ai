FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies first (cache layer)
# devDependencies are needed for the build step (@tailwindcss/cli, tailwindcss)
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy source (see .dockerignore for exclusions)
COPY . .

# Build frontend (Tailwind CSS + Bun.build)
RUN bun run build

# Create data directory for SQLite (Railway volume mount point)
RUN mkdir -p /app/data

EXPOSE 3000

CMD ["bun", "run", "start"]
