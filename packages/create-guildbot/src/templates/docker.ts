/**
 * Docker templates — Dockerfile and docker-compose.yml.
 */

import type { BotConfig } from "../types";

interface GeneratedFile {
  filePath: string;
  content: string;
}

export function getDockerTemplates(config: BotConfig): GeneratedFile[] {
  return [
    { filePath: "Dockerfile", content: dockerfile() },
    { filePath: "docker-compose.yml", content: dockerCompose(config) },
    { filePath: ".dockerignore", content: dockerignore() },
  ];
}

function dockerfile(): string {
  return `# ── Build stage ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --frozen-lockfile
COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts
RUN npm run build

# ── Production stage ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

ENV NODE_ENV=production
WORKDIR /app

COPY package*.json ./
RUN npm ci --frozen-lockfile --omit=dev

COPY --from=builder /app/dist ./dist
COPY config ./config

# Create data directory for SQLite
RUN mkdir -p /app/data

EXPOSE 3000

CMD ["node", "dist/index.js"]
`;
}

function dockerCompose(config: BotConfig): string {
  const isPg = config.database === "postgresql";

  return `version: "3.9"

services:
  bot:
    build: .
    restart: unless-stopped
    env_file: .env
    volumes:
      - bot-data:/app/data
${
  isPg
    ? `    depends_on:
      postgres:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://rexxy:rexxy@postgres:5432/rexxy`
    : ""
}
${
  config.dashboard
    ? `    ports:
      - "\${DASHBOARD_PORT:-3000}:3000"`
    : ""
}

${
  isPg
    ? `  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: rexxy
      POSTGRES_PASSWORD: rexxy
      POSTGRES_DB: rexxy
    volumes:
      - pg-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U rexxy"]
      interval: 5s
      timeout: 5s
      retries: 5`
    : ""
}

volumes:
  bot-data:
${isPg ? "  pg-data:" : ""}
`;
}

function dockerignore(): string {
  return `node_modules/
dist/
.env
data/
*.log
.git/
.DS_Store
`;
}
