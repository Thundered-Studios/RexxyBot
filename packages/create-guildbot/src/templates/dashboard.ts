/**
 * Dashboard scaffold templates — a professional Express-based admin panel.
 *
 * Files generated:
 *   dashboard/index.ts              — Express server (accepts RexxyClient)
 *   dashboard/routes/stats.ts       — GET /api/stats
 *   dashboard/routes/commands.ts    — GET /api/commands
 *   dashboard/routes/guilds.ts      — GET /api/guilds
 *   dashboard/routes/settings.ts    — GET/POST /api/settings
 *   dashboard/public/index.html     — Single-page admin panel
 */

import type { BotConfig } from "../types";

interface GeneratedFile {
  filePath: string;
  content: string;
}

export function getDashboardTemplates(_config: BotConfig): GeneratedFile[] {
  return [
    { filePath: "dashboard/index.ts",            content: dashboardIndex() },
    { filePath: "dashboard/routes/stats.ts",     content: statsRoute() },
    { filePath: "dashboard/routes/commands.ts",  content: commandsRoute() },
    { filePath: "dashboard/routes/guilds.ts",    content: guildsRoute() },
    { filePath: "dashboard/routes/settings.ts",  content: settingsRoute() },
    { filePath: "dashboard/public/index.html",   content: dashboardHtml() },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Express server
// ─────────────────────────────────────────────────────────────────────────────
function dashboardIndex(): string {
  return `/**
 * Dashboard server — Express REST API + static SPA for bot management.
 *
 * Called from src/index.ts after the bot is online:
 *   startDashboard(client, Number(process.env.DASHBOARD_PORT ?? 3000));
 *
 * ⚠️  This dashboard has no authentication by default.
 *     Set DASHBOARD_SECRET in .env and add middleware before deploying publicly.
 */

import express from "express";
import cors from "cors";
import path from "path";
import type { RexxyClient } from "../src/core/RexxyClient";
import { createStatsRouter }    from "./routes/stats";
import { createCommandsRouter } from "./routes/commands";
import { createGuildsRouter }   from "./routes/guilds";
import { createSettingsRouter } from "./routes/settings";

export function startDashboard(client: RexxyClient, port = 3000): void {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use(express.static(path.join(__dirname, "public")));

  // ── API routes ────────────────────────────────────────────────────────────
  app.use("/api/stats",    createStatsRouter(client));
  app.use("/api/commands", createCommandsRouter(client));
  app.use("/api/guilds",   createGuildsRouter(client));
  app.use("/api/settings", createSettingsRouter(client));

  // ── Fallback — serve the SPA for any unknown route ────────────────────────
  app.get("*", (_req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
  });

  app.listen(port, () => {
    client.logger.info(\`[Dashboard] Running at http://localhost:\${port}\`);
  });
}
`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────────
function statsRoute(): string {
  return `import { Router } from "express";
import type { RexxyClient } from "../../src/core/RexxyClient";

export function createStatsRouter(client: RexxyClient): Router {
  const router = Router();

  /** GET /api/stats — live bot statistics */
  router.get("/", (_req, res) => {
    const uptime  = Math.floor((client.discord.uptime ?? 0) / 1000);
    const hours   = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = uptime % 60;

    const totalUsers = client.discord.guilds.cache.reduce(
      (acc, g) => acc + g.memberCount,
      0,
    );

    res.json({
      status:      client.discord.isReady() ? "online" : "offline",
      botTag:      client.discord.user?.tag ?? "unknown",
      botAvatar:   client.discord.user?.displayAvatarURL({ size: 64 }) ?? null,
      guilds:      client.discord.guilds.cache.size,
      users:       totalUsers,
      commands:    client.commandHandler.commands.size,
      ping:        client.discord.ws.ping,
      memoryMB:    parseFloat((process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)),
      uptime:      \`\${hours}h \${minutes}m \${seconds}s\`,
      nodeVersion: process.version,
      timestamp:   new Date().toISOString(),
    });
  });

  return router;
}
`;
}

function commandsRoute(): string {
  return `import { Router } from "express";
import type { RexxyClient } from "../../src/core/RexxyClient";

export function createCommandsRouter(client: RexxyClient): Router {
  const router = Router();

  /** GET /api/commands — all registered commands */
  router.get("/", (_req, res) => {
    const commands = [...client.commandHandler.commands.values()].map((cmd) => ({
      name:        cmd.name,
      description: cmd.description,
      aliases:     cmd.aliases ?? [],
      hasSlash:    !!cmd.slashCommand,
    }));

    res.json({ commands, total: commands.length });
  });

  return router;
}
`;
}

function guildsRoute(): string {
  return `import { Router } from "express";
import type { RexxyClient } from "../../src/core/RexxyClient";

export function createGuildsRouter(client: RexxyClient): Router {
  const router = Router();

  /** GET /api/guilds — guilds the bot is a member of */
  router.get("/", (_req, res) => {
    const guilds = client.discord.guilds.cache.map((g) => ({
      id:          g.id,
      name:        g.name,
      memberCount: g.memberCount,
      icon:        g.iconURL({ size: 64 }) ?? null,
      owner:       g.ownerId,
    }));

    res.json({ guilds, total: guilds.length });
  });

  return router;
}
`;
}

function settingsRoute(): string {
  return `import { Router } from "express";
import fs from "fs";
import path from "path";
import type { RexxyClient } from "../../src/core/RexxyClient";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MutableConfig = Record<string, any>;

/** Persist a key=value pair in the .env file (best-effort). */
function updateEnv(key: string, value: string): void {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;

  let content = fs.readFileSync(envPath, "utf8");
  const regex = new RegExp(\`^(\${key}=).*\$\`, "m");

  if (regex.test(content)) {
    content = content.replace(regex, \`\${key}=\${value}\`);
  } else {
    content += \`\\n\${key}=\${value}\\n\`;
  }

  fs.writeFileSync(envPath, content, "utf8");
}

export function createSettingsRouter(client: RexxyClient): Router {
  const router = Router();

  /** GET /api/settings — current bot configuration */
  router.get("/", (_req, res) => {
    res.json({
      botName:        client.config.botName,
      prefix:         client.config.prefix,
      enabledPlugins: client.config.enabledPlugins,
      dbType:         client.config.database.type,
    });
  });

  /** POST /api/settings/prefix — update command prefix at runtime */
  router.post("/prefix", (req, res) => {
    const { prefix } = req.body as { prefix?: string };
    if (!prefix || typeof prefix !== "string" || prefix.length > 5) {
      return res.status(400).json({ error: "Prefix must be 1–5 characters." });
    }
    (client.config as MutableConfig).prefix = prefix;
    process.env.COMMAND_PREFIX = prefix;
    updateEnv("COMMAND_PREFIX", prefix);
    res.json({ success: true, prefix });
  });

  /** POST /api/settings/plugins — update enabled plugins at runtime */
  router.post("/plugins", (req, res) => {
    const { plugins } = req.body as { plugins?: string[] };
    if (!Array.isArray(plugins)) {
      return res.status(400).json({ error: "plugins must be an array." });
    }
    (client.config as MutableConfig).enabledPlugins = plugins;
    process.env.ENABLED_PLUGINS = plugins.join(",");
    updateEnv("ENABLED_PLUGINS", plugins.join(","));
    res.json({ success: true, plugins, note: "Restart the bot to apply plugin changes." });
  });

  return router;
}
`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Single-page admin panel HTML
// ─────────────────────────────────────────────────────────────────────────────
function dashboardHtml(): string {
  /* All ${...} inside this string that should appear literally in the HTML
     are escaped as \${...} — they are browser-side JS template literals. */
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Rexxy Dashboard</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg:       #0d1117;
      --surface:  #161b22;
      --surface2: #1c2128;
      --border:   #30363d;
      --text:     #e6edf3;
      --muted:    #8b949e;
      --accent:   #5865f2;
      --accent-h: #4752c4;
      --success:  #3fb950;
      --warning:  #d29922;
      --danger:   #f85149;
      --sidebar-w: 240px;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      overflow-x: hidden;
    }

    /* ── Sidebar ──────────────────────────────────────────────────── */
    .sidebar {
      width: var(--sidebar-w);
      min-height: 100vh;
      background: var(--surface);
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      position: fixed;
      top: 0; left: 0;
      z-index: 10;
    }

    .sidebar-brand {
      padding: 1.25rem 1rem;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .sidebar-avatar {
      width: 40px; height: 40px;
      border-radius: 50%;
      background: var(--accent);
      display: flex; align-items: center; justify-content: center;
      font-size: 1.1rem;
      flex-shrink: 0;
      overflow: hidden;
    }
    .sidebar-avatar img { width: 100%; height: 100%; object-fit: cover; }

    .sidebar-brand-text { overflow: hidden; }
    .sidebar-brand-name {
      font-weight: 700;
      font-size: 0.95rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .sidebar-brand-status {
      font-size: 0.72rem;
      color: var(--success);
      display: flex; align-items: center; gap: 0.3rem;
    }
    .sidebar-brand-status::before {
      content: "";
      width: 7px; height: 7px;
      border-radius: 50%;
      background: var(--success);
      flex-shrink: 0;
    }
    .sidebar-brand-status.offline { color: var(--danger); }
    .sidebar-brand-status.offline::before { background: var(--danger); }

    .sidebar-nav { padding: 0.75rem 0; flex: 1; }
    .nav-label {
      padding: 0.5rem 1rem 0.25rem;
      font-size: 0.68rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--muted);
    }
    .nav-item {
      display: flex; align-items: center; gap: 0.7rem;
      padding: 0.6rem 1rem;
      cursor: pointer;
      border-radius: 6px;
      margin: 1px 0.5rem;
      font-size: 0.9rem;
      color: var(--muted);
      transition: background 0.15s, color 0.15s;
      user-select: none;
    }
    .nav-item:hover { background: var(--surface2); color: var(--text); }
    .nav-item.active { background: var(--accent); color: #fff; }
    .nav-item .icon { font-size: 1rem; width: 1.1rem; text-align: center; }

    .sidebar-footer {
      padding: 0.75rem 1rem;
      border-top: 1px solid var(--border);
      font-size: 0.75rem;
      color: var(--muted);
    }

    /* ── Main ─────────────────────────────────────────────────────── */
    .main {
      margin-left: var(--sidebar-w);
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }

    .topbar {
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      padding: 0.85rem 1.5rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: sticky; top: 0; z-index: 5;
    }
    .topbar-title { font-size: 1.05rem; font-weight: 600; }
    .topbar-badge {
      background: var(--surface2);
      border: 1px solid var(--border);
      border-radius: 999px;
      padding: 0.25rem 0.75rem;
      font-size: 0.78rem;
      color: var(--muted);
    }
    .topbar-badge span { color: var(--text); font-weight: 600; }

    .content {
      padding: 1.5rem;
      flex: 1;
    }

    /* ── Sections ─────────────────────────────────────────────────── */
    .section { display: none; }
    .section.active { display: block; }

    /* ── Stats grid ───────────────────────────────────────────────── */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .stat-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 1.1rem 1.2rem;
    }
    .stat-label {
      font-size: 0.75rem;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-bottom: 0.4rem;
    }
    .stat-value {
      font-size: 1.6rem;
      font-weight: 700;
      line-height: 1;
    }
    .stat-sub { font-size: 0.75rem; color: var(--muted); margin-top: 0.3rem; }
    .stat-card.accent  .stat-value { color: var(--accent); }
    .stat-card.success .stat-value { color: var(--success); }
    .stat-card.warning .stat-value { color: var(--warning); }

    /* ── Info row ─────────────────────────────────────────────────── */
    .info-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }
    .info-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 1.1rem 1.2rem;
    }
    .info-card h3 {
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--muted);
      margin-bottom: 0.75rem;
    }
    .info-row-item {
      display: flex;
      justify-content: space-between;
      padding: 0.3rem 0;
      border-bottom: 1px solid var(--border);
      font-size: 0.88rem;
    }
    .info-row-item:last-child { border-bottom: none; }
    .info-row-item span:last-child { color: var(--accent); font-weight: 500; }

    /* ── Table ────────────────────────────────────────────────────── */
    .table-toolbar {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 1rem;
    }
    .search-input {
      flex: 1;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 0.5rem 0.75rem;
      color: var(--text);
      font-size: 0.88rem;
      outline: none;
      transition: border-color 0.15s;
    }
    .search-input:focus { border-color: var(--accent); }
    .search-input::placeholder { color: var(--muted); }

    .count-badge {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 999px;
      padding: 0.3rem 0.75rem;
      font-size: 0.8rem;
      color: var(--muted);
      white-space: nowrap;
    }

    .table-wrap {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      overflow: hidden;
    }
    table { width: 100%; border-collapse: collapse; }
    thead th {
      background: var(--surface2);
      padding: 0.7rem 1rem;
      text-align: left;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--muted);
      border-bottom: 1px solid var(--border);
    }
    tbody tr { transition: background 0.1s; }
    tbody tr:hover { background: var(--surface2); }
    tbody td {
      padding: 0.7rem 1rem;
      font-size: 0.88rem;
      border-bottom: 1px solid var(--border);
      vertical-align: middle;
    }
    tbody tr:last-child td { border-bottom: none; }

    .cmd-name { font-family: monospace; font-size: 0.9rem; color: var(--accent); }
    .badge {
      display: inline-flex; align-items: center; justify-content: center;
      border-radius: 4px;
      padding: 0.18rem 0.5rem;
      font-size: 0.7rem;
      font-weight: 600;
      line-height: 1;
    }
    .badge-slash { background: rgba(88,101,242,0.2); color: var(--accent); }
    .badge-prefix { background: rgba(139,148,158,0.15); color: var(--muted); }
    .alias-list { font-size: 0.78rem; color: var(--muted); }

    /* ── Guilds grid ──────────────────────────────────────────────── */
    .guilds-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 1rem;
    }
    .guild-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 1rem;
      display: flex;
      align-items: center;
      gap: 0.9rem;
    }
    .guild-icon {
      width: 48px; height: 48px;
      border-radius: 50%;
      background: var(--accent);
      display: flex; align-items: center; justify-content: center;
      font-size: 1.2rem;
      flex-shrink: 0;
      overflow: hidden;
    }
    .guild-icon img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }
    .guild-name { font-weight: 600; font-size: 0.9rem; }
    .guild-members { font-size: 0.78rem; color: var(--muted); margin-top: 0.15rem; }

    /* ── Settings ─────────────────────────────────────────────────── */
    .settings-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
      gap: 1.25rem;
    }
    .settings-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 1.25rem;
    }
    .settings-card h3 {
      font-size: 0.88rem;
      font-weight: 600;
      margin-bottom: 0.3rem;
    }
    .settings-card p {
      font-size: 0.8rem;
      color: var(--muted);
      margin-bottom: 1rem;
    }
    .field-label {
      display: block;
      font-size: 0.78rem;
      font-weight: 600;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.4rem;
    }
    .field-input {
      width: 100%;
      background: var(--surface2);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 0.55rem 0.75rem;
      color: var(--text);
      font-size: 0.9rem;
      outline: none;
      transition: border-color 0.15s;
    }
    .field-input:focus { border-color: var(--accent); }
    .field-row { margin-bottom: 1rem; }

    .btn {
      display: inline-flex; align-items: center; gap: 0.4rem;
      padding: 0.55rem 1.1rem;
      border: none; border-radius: 6px;
      font-size: 0.88rem; font-weight: 600; cursor: pointer;
      transition: background 0.15s, opacity 0.15s;
    }
    .btn-primary { background: var(--accent); color: #fff; }
    .btn-primary:hover { background: var(--accent-h); }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

    .toast {
      position: fixed; bottom: 1.5rem; right: 1.5rem;
      background: var(--surface2);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 0.75rem 1.1rem;
      font-size: 0.88rem;
      box-shadow: 0 8px 24px rgba(0,0,0,0.4);
      z-index: 100;
      opacity: 0;
      transform: translateY(8px);
      transition: opacity 0.25s, transform 0.25s;
      pointer-events: none;
    }
    .toast.show { opacity: 1; transform: translateY(0); }
    .toast.success { border-color: var(--success); }
    .toast.error   { border-color: var(--danger); }

    .plugin-toggles { display: flex; flex-direction: column; gap: 0.5rem; }
    .plugin-toggle {
      display: flex; align-items: center; justify-content: space-between;
      background: var(--surface2);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 0.5rem 0.75rem;
    }
    .plugin-toggle-name { font-size: 0.88rem; font-weight: 500; }
    .toggle-switch { position: relative; width: 36px; height: 20px; cursor: pointer; }
    .toggle-switch input { opacity: 0; width: 0; height: 0; }
    .toggle-slider {
      position: absolute; inset: 0;
      background: var(--border);
      border-radius: 999px;
      transition: background 0.2s;
    }
    .toggle-slider::before {
      content: "";
      position: absolute;
      left: 3px; top: 3px;
      width: 14px; height: 14px;
      background: #fff;
      border-radius: 50%;
      transition: transform 0.2s;
    }
    .toggle-switch input:checked + .toggle-slider { background: var(--accent); }
    .toggle-switch input:checked + .toggle-slider::before { transform: translateX(16px); }

    @media (max-width: 768px) {
      .sidebar { display: none; }
      .main { margin-left: 0; }
      .info-row { grid-template-columns: 1fr; }
    }

    .loading {
      color: var(--muted);
      font-size: 0.88rem;
      padding: 2rem;
      text-align: center;
    }
  </style>
</head>
<body>

<!-- ── Sidebar ──────────────────────────────────────────────────────── -->
<aside class="sidebar">
  <div class="sidebar-brand">
    <div class="sidebar-avatar" id="sidebar-avatar">⚡</div>
    <div class="sidebar-brand-text">
      <div class="sidebar-brand-name" id="sidebar-name">Loading…</div>
      <div class="sidebar-brand-status" id="sidebar-status">connecting</div>
    </div>
  </div>

  <nav class="sidebar-nav">
    <div class="nav-label">Dashboard</div>
    <div class="nav-item active" data-section="overview">
      <span class="icon">📊</span> Overview
    </div>
    <div class="nav-label">Bot</div>
    <div class="nav-item" data-section="commands">
      <span class="icon">⚡</span> Commands
    </div>
    <div class="nav-item" data-section="guilds">
      <span class="icon">🏠</span> Servers
    </div>
    <div class="nav-label">Config</div>
    <div class="nav-item" data-section="settings">
      <span class="icon">⚙️</span> Settings
    </div>
  </nav>

  <div class="sidebar-footer">Powered by Rexxy</div>
</aside>

<!-- ── Main ─────────────────────────────────────────────────────────── -->
<div class="main">
  <header class="topbar">
    <span class="topbar-title" id="topbar-title">Overview</span>
    <span class="topbar-badge">Ping: <span id="topbar-ping">—</span> ms</span>
  </header>

  <div class="content">

    <!-- Overview -->
    <section class="section active" id="section-overview">
      <div class="stats-grid">
        <div class="stat-card success">
          <div class="stat-label">Servers</div>
          <div class="stat-value" id="stat-guilds">—</div>
          <div class="stat-sub">guilds the bot is in</div>
        </div>
        <div class="stat-card accent">
          <div class="stat-label">Users</div>
          <div class="stat-value" id="stat-users">—</div>
          <div class="stat-sub">total across all servers</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Commands</div>
          <div class="stat-value" id="stat-commands">—</div>
          <div class="stat-sub">loaded and registered</div>
        </div>
        <div class="stat-card warning">
          <div class="stat-label">Uptime</div>
          <div class="stat-value" id="stat-uptime" style="font-size:1.1rem;margin-top:0.2rem">—</div>
          <div class="stat-sub">since last restart</div>
        </div>
      </div>

      <div class="info-row">
        <div class="info-card">
          <h3>Runtime</h3>
          <div class="info-row-item"><span>Memory</span><span id="info-memory">—</span></div>
          <div class="info-row-item"><span>WebSocket Ping</span><span id="info-ping">—</span></div>
          <div class="info-row-item"><span>Node.js</span><span id="info-node">—</span></div>
          <div class="info-row-item"><span>Status</span><span id="info-status">—</span></div>
        </div>
        <div class="info-card">
          <h3>Bot Info</h3>
          <div class="info-row-item"><span>Tag</span><span id="info-tag">—</span></div>
          <div class="info-row-item"><span>Guilds</span><span id="info-guilds">—</span></div>
          <div class="info-row-item"><span>Commands loaded</span><span id="info-commands">—</span></div>
          <div class="info-row-item"><span>Last refresh</span><span id="info-refresh">—</span></div>
        </div>
      </div>
    </section>

    <!-- Commands -->
    <section class="section" id="section-commands">
      <div class="table-toolbar">
        <input class="search-input" id="cmd-search" placeholder="Search commands…" />
        <span class="count-badge" id="cmd-count">0 commands</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Command</th>
              <th>Description</th>
              <th>Aliases</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody id="commands-body">
            <tr><td colspan="4" class="loading">Loading commands…</td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Guilds -->
    <section class="section" id="section-guilds">
      <div class="table-toolbar">
        <input class="search-input" id="guild-search" placeholder="Search servers…" />
        <span class="count-badge" id="guild-count">0 servers</span>
      </div>
      <div class="guilds-grid" id="guilds-grid">
        <div class="loading">Loading servers…</div>
      </div>
    </section>

    <!-- Settings -->
    <section class="section" id="section-settings">
      <div class="settings-grid">

        <div class="settings-card">
          <h3>Command Prefix</h3>
          <p>The prefix used for text-based commands. Takes effect immediately.</p>
          <div class="field-row">
            <label class="field-label" for="setting-prefix">Prefix</label>
            <input class="field-input" id="setting-prefix" maxlength="5" placeholder="!" />
          </div>
          <button class="btn btn-primary" id="btn-save-prefix">Save Prefix</button>
        </div>

        <div class="settings-card">
          <h3>Enabled Plugins</h3>
          <p>Toggle plugins on or off. Restart the bot to apply changes.</p>
          <div class="plugin-toggles" id="plugin-toggles">
            <div class="loading">Loading…</div>
          </div>
          <br />
          <button class="btn btn-primary" id="btn-save-plugins">Save Plugins</button>
        </div>

      </div>
    </section>

  </div>
</div>

<!-- Toast notification -->
<div class="toast" id="toast"></div>

<script>
  // ── Navigation ────────────────────────────────────────────────────────────
  const TITLES = { overview: "Overview", commands: "Commands", guilds: "Servers", settings: "Settings" };
  let allCommands = [], allGuilds = [], currentPlugins = [];

  const ALL_PLUGINS = ["utility","moderation","leveling","economy","logging","welcome","reaction-roles"];

  document.querySelectorAll(".nav-item").forEach(item => {
    item.addEventListener("click", () => {
      const id = item.dataset.section;
      document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
      document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));
      item.classList.add("active");
      document.getElementById(\`section-\${id}\`).classList.add("active");
      document.getElementById("topbar-title").textContent = TITLES[id] || id;
      if (id === "commands" && allCommands.length === 0) loadCommands();
      if (id === "guilds"   && allGuilds.length   === 0) loadGuilds();
      if (id === "settings") loadSettings();
    });
  });

  // ── Toast ─────────────────────────────────────────────────────────────────
  function showToast(msg, type = "success") {
    const t = document.getElementById("toast");
    t.textContent = msg;
    t.className = \`toast show \${type}\`;
    setTimeout(() => { t.classList.remove("show"); }, 3000);
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  async function loadStats() {
    try {
      const data = await fetch("/api/stats").then(r => r.json());

      // Sidebar
      const av = document.getElementById("sidebar-avatar");
      if (data.botAvatar) av.innerHTML = \`<img src="\${data.botAvatar}" alt="" />\`;
      document.getElementById("sidebar-name").textContent  = data.botTag ?? "—";
      const statusEl = document.getElementById("sidebar-status");
      statusEl.textContent  = data.status;
      statusEl.className    = \`sidebar-brand-status \${data.status !== "online" ? "offline" : ""}\`;

      // Topbar
      document.getElementById("topbar-ping").textContent = data.ping ?? "—";

      // Cards
      document.getElementById("stat-guilds").textContent   = data.guilds   ?? "—";
      document.getElementById("stat-users").textContent    = data.users    ?? "—";
      document.getElementById("stat-commands").textContent = data.commands ?? "—";
      document.getElementById("stat-uptime").textContent   = data.uptime   ?? "—";

      // Info
      document.getElementById("info-memory").textContent   = data.memoryMB + " MB";
      document.getElementById("info-ping").textContent     = data.ping + " ms";
      document.getElementById("info-node").textContent     = data.nodeVersion;
      document.getElementById("info-status").textContent   = data.status;
      document.getElementById("info-tag").textContent      = data.botTag;
      document.getElementById("info-guilds").textContent   = data.guilds;
      document.getElementById("info-commands").textContent = data.commands;
      document.getElementById("info-refresh").textContent  = new Date(data.timestamp).toLocaleTimeString();
    } catch {
      document.getElementById("sidebar-status").textContent = "offline";
    }
  }

  // ── Commands ──────────────────────────────────────────────────────────────
  async function loadCommands() {
    const { commands = [] } = await fetch("/api/commands").then(r => r.json()).catch(() => ({}));
    allCommands = commands;
    renderCommands(commands);
  }

  function renderCommands(cmds) {
    const body = document.getElementById("commands-body");
    document.getElementById("cmd-count").textContent = \`\${cmds.length} command\${cmds.length !== 1 ? "s" : ""}\`;
    if (!cmds.length) {
      body.innerHTML = '<tr><td colspan="4" class="loading">No commands found.</td></tr>';
      return;
    }
    body.innerHTML = cmds.map(c => \`
      <tr>
        <td><span class="cmd-name">/\${c.name}</span></td>
        <td>\${escHtml(c.description)}</td>
        <td><span class="alias-list">\${c.aliases.length ? c.aliases.map(a => \`!\${a}\`).join(", ") : "—"}</span></td>
        <td>
          \${c.hasSlash ? '<span class="badge badge-slash">/ Slash</span>' : ""}
          <span class="badge badge-prefix">Prefix</span>
        </td>
      </tr>
    \`).join("");
  }

  document.getElementById("cmd-search").addEventListener("input", e => {
    const q = e.target.value.toLowerCase();
    renderCommands(allCommands.filter(c =>
      c.name.includes(q) || c.description.toLowerCase().includes(q)
    ));
  });

  // ── Guilds ────────────────────────────────────────────────────────────────
  async function loadGuilds() {
    const { guilds = [] } = await fetch("/api/guilds").then(r => r.json()).catch(() => ({}));
    allGuilds = guilds;
    renderGuilds(guilds);
  }

  function renderGuilds(list) {
    const grid = document.getElementById("guilds-grid");
    document.getElementById("guild-count").textContent = \`\${list.length} server\${list.length !== 1 ? "s" : ""}\`;
    if (!list.length) { grid.innerHTML = '<div class="loading">No servers found.</div>'; return; }
    grid.innerHTML = list.map(g => \`
      <div class="guild-card">
        <div class="guild-icon">
          \${g.icon ? \`<img src="\${g.icon}" alt="" />\` : \`\${escHtml(g.name.charAt(0))}\`}
        </div>
        <div>
          <div class="guild-name">\${escHtml(g.name)}</div>
          <div class="guild-members">\${g.memberCount.toLocaleString()} members</div>
        </div>
      </div>
    \`).join("");
  }

  document.getElementById("guild-search").addEventListener("input", e => {
    const q = e.target.value.toLowerCase();
    renderGuilds(allGuilds.filter(g => g.name.toLowerCase().includes(q)));
  });

  // ── Settings ──────────────────────────────────────────────────────────────
  async function loadSettings() {
    const data = await fetch("/api/settings").then(r => r.json()).catch(() => ({}));
    if (data.prefix) document.getElementById("setting-prefix").value = data.prefix;
    currentPlugins = data.enabledPlugins ?? [];
    renderPluginToggles(currentPlugins);
  }

  function renderPluginToggles(enabled) {
    const container = document.getElementById("plugin-toggles");
    container.innerHTML = ALL_PLUGINS.map(p => \`
      <div class="plugin-toggle">
        <span class="plugin-toggle-name">\${p}</span>
        <label class="toggle-switch">
          <input type="checkbox" value="\${p}" \${enabled.includes(p) ? "checked" : ""} />
          <span class="toggle-slider"></span>
        </label>
      </div>
    \`).join("");
  }

  document.getElementById("btn-save-prefix").addEventListener("click", async () => {
    const prefix = document.getElementById("setting-prefix").value.trim();
    if (!prefix) return showToast("Prefix cannot be empty.", "error");
    const res = await fetch("/api/settings/prefix", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prefix }),
    });
    const data = await res.json();
    if (data.success) showToast(\`Prefix updated to "\${data.prefix}"\`);
    else showToast(data.error || "Error saving prefix.", "error");
  });

  document.getElementById("btn-save-plugins").addEventListener("click", async () => {
    const checked = [...document.querySelectorAll("#plugin-toggles input:checked")].map(i => i.value);
    const res = await fetch("/api/settings/plugins", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plugins: checked }),
    });
    const data = await res.json();
    if (data.success) showToast(data.note ?? "Plugins saved.");
    else showToast(data.error || "Error saving plugins.", "error");
  });

  // ── Helpers ───────────────────────────────────────────────────────────────
  function escHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // ── Boot ──────────────────────────────────────────────────────────────────
  loadStats();
  setInterval(loadStats, 15000);
</script>
</body>
</html>`;
}
