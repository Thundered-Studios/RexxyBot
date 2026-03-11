/**
 * Dashboard scaffold templates — a minimal Express-based web dashboard.
 */

import type { BotConfig } from "../types";

interface GeneratedFile {
  filePath: string;
  content: string;
}

export function getDashboardTemplates(_config: BotConfig): GeneratedFile[] {
  return [
    { filePath: "dashboard/index.ts", content: dashboardIndex() },
    { filePath: "dashboard/routes/stats.ts", content: statsRoute() },
    { filePath: "dashboard/routes/guilds.ts", content: guildsRoute() },
    { filePath: "dashboard/public/index.html", content: dashboardHtml() },
  ];
}

function dashboardIndex(): string {
  return `/**
 * Dashboard server — minimal Express REST API for bot management.
 *
 * Start it alongside the bot by importing this file from src/index.ts,
 * or run it independently.
 */

import express from "express";
import cors from "cors";
import { statsRouter } from "./routes/stats";
import { guildsRouter } from "./routes/guilds";

export function startDashboard(port = 3000): void {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(express.static("dashboard/public"));

  // ── Routes ──────────────────────────────────────────────────────────
  app.use("/api/stats",  statsRouter);
  app.use("/api/guilds", guildsRouter);

  app.listen(port, () => {
    console.log(\`[Dashboard] Running at http://localhost:\${port}\`);
  });
}
`;
}

function statsRoute(): string {
  return `import { Router } from "express";

export const statsRouter = Router();

/** GET /api/stats — returns basic bot statistics */
statsRouter.get("/", (_req, res) => {
  // TODO: inject the RexxyClient to read real stats
  res.json({
    uptime: process.uptime(),
    memoryMB: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2),
    nodeVersion: process.version,
    timestamp: new Date().toISOString(),
  });
});
`;
}

function guildsRoute(): string {
  return `import { Router } from "express";

export const guildsRouter = Router();

/**
 * GET /api/guilds — placeholder; wire up to client.guilds.cache for real data.
 */
guildsRouter.get("/", (_req, res) => {
  // TODO: inject the RexxyClient and return client.guilds.cache
  res.json({ guilds: [], message: "Connect the RexxyClient to populate this." });
});
`;
}

function dashboardHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Rexxy Dashboard</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0d1117;
      color: #c9d1d9;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 2rem;
    }
    h1 { color: #5865f2; font-size: 2rem; margin-bottom: 0.5rem; }
    p  { color: #8b949e; margin-bottom: 2rem; }
    .card {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 8px;
      padding: 1.5rem 2rem;
      width: 100%;
      max-width: 480px;
      margin-bottom: 1rem;
    }
    .card h2 { font-size: 1rem; color: #8b949e; margin-bottom: 0.75rem; }
    .stat { display: flex; justify-content: space-between; padding: 0.25rem 0; }
    .stat span:last-child { color: #58a6ff; font-weight: 600; }
    .badge {
      display: inline-block;
      background: #5865f2;
      color: #fff;
      border-radius: 4px;
      padding: 0.15rem 0.5rem;
      font-size: 0.75rem;
      margin-top: 1rem;
    }
  </style>
</head>
<body>
  <h1>⚡ Rexxy Dashboard</h1>
  <p>Your bot's control center</p>

  <div class="card" id="stats-card">
    <h2>Bot Statistics</h2>
    <div class="stat"><span>Uptime</span> <span id="uptime">—</span></div>
    <div class="stat"><span>Memory</span> <span id="memory">—</span></div>
    <div class="stat"><span>Node.js</span> <span id="node">—</span></div>
  </div>

  <span class="badge">powered by Rexxy</span>

  <script>
    async function loadStats() {
      try {
        const res = await fetch("/api/stats");
        const data = await res.json();
        const uptime = Math.floor(data.uptime);
        const h = Math.floor(uptime / 3600);
        const m = Math.floor((uptime % 3600) / 60);
        const s = uptime % 60;
        document.getElementById("uptime").textContent =
          \`\${h}h \${m}m \${s}s\`;
        document.getElementById("memory").textContent =
          \`\${data.memoryMB} MB\`;
        document.getElementById("node").textContent = data.nodeVersion;
      } catch {
        document.getElementById("uptime").textContent = "offline";
      }
    }
    loadStats();
    setInterval(loadStats, 10000);
  </script>
</body>
</html>
`;
}
