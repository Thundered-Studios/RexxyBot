/**
 * Root-level project file templates:
 *   package.json, tsconfig.json, .env, .gitignore, src/index.ts, README.md
 */

import type { BotConfig } from "../types";

interface GeneratedFile {
  filePath: string;
  content: string;
}

export function getRootTemplates(config: BotConfig): GeneratedFile[] {
  return [
    { filePath: "package.json", content: packageJson(config) },
    { filePath: "tsconfig.json", content: tsconfig() },
    { filePath: ".env", content: dotenv(config) },
    { filePath: ".env.example", content: dotenvExample() },
    { filePath: ".gitignore", content: gitignore() },
    { filePath: "src/index.ts", content: entrypoint(config) },
    { filePath: "README.md", content: readme(config) },
    { filePath: "scripts/deploy-commands.ts", content: deployCommands() },
  ];
}

// ---------------------------------------------------------------------------

function packageJson(config: BotConfig): string {
  const deps: Record<string, string> = {
    "discord.js": "^14.15.3",
    dotenv: "^16.4.5",
  };

  if (config.database === "sqlite") {
    deps["better-sqlite3"] = "^9.6.0";
  } else {
    deps["pg"] = "^8.12.0";
  }

  if (config.dashboard) {
    deps["express"] = "^4.19.2";
    deps["cors"] = "^2.8.5";
  }

  const devDeps: Record<string, string> = {
    "@types/node": "^20.14.0",
    "ts-node": "^10.9.2",
    "ts-node-dev": "^2.0.0",
    typescript: "^5.4.5",
  };

  if (config.database === "sqlite") {
    devDeps["@types/better-sqlite3"] = "^7.6.10";
  } else {
    devDeps["@types/pg"] = "^8.11.6";
  }

  if (config.dashboard) {
    devDeps["@types/express"] = "^4.17.21";
    devDeps["@types/cors"] = "^2.8.17";
  }

  const botName = config.botName.toLowerCase().replace(/\s+/g, "-");

  return JSON.stringify(
    {
      name: `${botName}-rexxy`,
      version: "1.0.0",
      description: `${config.botName} — a Discord bot powered by Rexxy`,
      main: "dist/index.js",
      scripts: {
        build: "tsc",
        start: "node dist/index.js",
        dev: "ts-node-dev --respawn --transpile-only src/index.ts",
        "deploy-commands": "ts-node scripts/deploy-commands.ts",
        lint: "tsc --noEmit",
      },
      dependencies: deps,
      devDependencies: devDeps,
      engines: { node: ">=18.0.0" },
    },
    null,
    2
  );
}

function tsconfig(): string {
  return JSON.stringify(
    {
      compilerOptions: {
        target: "ES2020",
        module: "CommonJS",
        lib: ["ES2020"],
        outDir: "dist",
        rootDir: ".",
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        resolveJsonModule: true,
        declaration: true,
        sourceMap: true,
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
      },
      include: ["src/**/*", "scripts/**/*"],
      exclude: ["node_modules", "dist"],
    },
    null,
    2
  );
}

function dotenv(config: BotConfig): string {
  const dbSection =
    config.database === "sqlite"
      ? `DB_TYPE=sqlite\nDB_PATH=./data/rexxy.db`
      : `DB_TYPE=postgresql\nDATABASE_URL=postgresql://user:password@localhost:5432/rexxy`;

  return `# ─── Bot ───────────────────────────────────────────────────────────
DISCORD_TOKEN=${config.token}
BOT_NAME=${config.botName}
COMMAND_PREFIX=${config.prefix}
ENABLED_PLUGINS=${config.plugins.join(",")}

# ─── Database ───────────────────────────────────────────────────────
${dbSection}

# ─── Optional ───────────────────────────────────────────────────────
# Set DEBUG=1 to enable verbose debug logging
# DEBUG=1
${config.dashboard ? "\n# ─── Dashboard ─────────────────────────────────────────────────────\nDASHBOARD_PORT=3000\nDASHBOARD_SECRET=change-me-in-production" : ""}
`;
}

function dotenvExample(): string {
  return `# Copy this file to .env and fill in the values.

# ─── Bot ───────────────────────────────────────────────────────────
DISCORD_TOKEN=your-bot-token-here
BOT_NAME=Rexxy
COMMAND_PREFIX=!
ENABLED_PLUGINS=moderation,leveling,logging

# ─── Database ───────────────────────────────────────────────────────
DB_TYPE=sqlite           # sqlite | postgresql
DB_PATH=./data/rexxy.db  # SQLite only
# DATABASE_URL=postgresql://user:password@localhost:5432/rexxy

# ─── Optional ───────────────────────────────────────────────────────
# DEBUG=1
`;
}

function gitignore(): string {
  return `node_modules/
dist/
*.js.map
.env
data/
*.log
.DS_Store
coverage/
`;
}

function entrypoint(config: BotConfig): string {
  return `/**
 * ${config.botName} — entry point.
 * Powered by Rexxy (https://github.com/rexxy-framework/rexxy)
 */

import { RexxyClient } from "./core/RexxyClient";
${config.dashboard ? `import { startDashboard } from "../dashboard/index";` : ""}

const client = new RexxyClient();

// Expose db and command map on the Discord client for plugin event handlers.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(client.discord as any).__rexxyDb = client.db;

// ── Start ───────────────────────────────────────────────────────────────────
client.start().then(() => {
  // Expose command map after plugins are loaded so /help can read it.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (client.discord as any).__rexxyCommands = client.commandHandler.commands;
${
  config.dashboard
    ? `
  // Start the web dashboard (default http://localhost:3000 — override with DASHBOARD_PORT).
  const dashPort = Number(process.env.DASHBOARD_PORT ?? 3000);
  startDashboard(client, dashPort);
`
    : ""
}}).catch((err) => {
  console.error("Fatal error starting ${config.botName}:", err);
  process.exit(1);
});

// ── Graceful shutdown ────────────────────────────────────────────────────────
const shutdown = async (signal: string) => {
  client.logger.info(\`Received \${signal} — shutting down gracefully…\`);
  await client.stop();
  process.exit(0);
};

process.on("SIGINT",  () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("uncaughtException",  (err) => { client.logger.error("Uncaught exception:", err); });
process.on("unhandledRejection", (err) => { client.logger.error("Unhandled rejection:", err); });
`;
}

function deployCommands(): string {
  return `/**
 * Standalone script to register / refresh Discord application commands.
 * Run with: npm run deploy-commands
 */

import "dotenv/config";
import { REST, Routes } from "discord.js";
import { RexxyClient } from "../src/core/RexxyClient";

(async () => {
  const token = process.env.DISCORD_TOKEN;
  if (!token) throw new Error("DISCORD_TOKEN is not set.");

  const client = new RexxyClient();
  await client.pluginLoader.loadAll();

  const rest = new REST({ version: "10" }).setToken(token);

  // Log in briefly to get client ID
  await client.discord.login(token);
  const clientId = client.discord.user!.id;
  client.discord.destroy();

  const commands = [...(client as never as { commandHandler: { commands: Map<string, { slashCommand?: { toJSON: () => unknown } }> } }).commandHandler.commands.values()]
    .filter((c) => c.slashCommand)
    .map((c) => c.slashCommand!.toJSON());

  console.log(\`Registering \${commands.length} slash command(s) for client \${clientId}…\`);
  await rest.put(Routes.applicationCommands(clientId), { body: commands });
  console.log("Done!");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
`;
}

function readme(config: BotConfig): string {
  return `# ${config.botName}

> A Discord bot powered by [**Rexxy**](https://github.com/rexxy-framework/rexxy) — the open-source modular bot framework.

## Quick Start

\`\`\`bash
# 1. Install dependencies
npm install

# 2. Copy environment file and fill in your Discord bot token
cp .env.example .env

# 3. Start the bot in development mode
npm run dev
\`\`\`

## Configuration

All configuration is read from environment variables (see \`.env.example\`):

| Variable | Description | Default |
|---|---|---|
| \`DISCORD_TOKEN\` | Your Discord bot token | — |
| \`BOT_NAME\` | Display name for the bot | \`${config.botName}\` |
| \`COMMAND_PREFIX\` | Prefix for text commands | \`${config.prefix}\` |
| \`ENABLED_PLUGINS\` | Comma-separated plugin IDs | \`${config.plugins.join(",")}\` |
| \`DB_TYPE\` | \`sqlite\` or \`postgresql\` | \`${config.database}\` |

## Enabled Plugins

${config.plugins.map((p) => `- **${p}**`).join("\n")}

## Adding a Plugin

1. Create a folder under \`src/plugins/my-plugin/\`.
2. Export a \`Plugin\` object as the default export from \`index.ts\`.
3. Add \`my-plugin\` to \`ENABLED_PLUGINS\` in your \`.env\`.

The \`PluginLoader\` will automatically discover and load it on next start.

\`\`\`ts
import type { Plugin } from "../../core/types";

const plugin: Plugin = {
  name: "my-plugin",
  version: "1.0.0",
  description: "My awesome custom plugin.",
  commands: [],
  events: [],
};

export default plugin;
\`\`\`

## Scripts

| Command | Description |
|---|---|
| \`npm run dev\` | Start with live-reload (ts-node-dev) |
| \`npm run build\` | Compile TypeScript to \`dist/\` |
| \`npm run start\` | Run compiled production build |
| \`npm run deploy-commands\` | Re-register slash commands with Discord |

## License

MIT — see [LICENSE](../../LICENSE).
`;
}
