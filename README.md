<div align="center">

# ⚡ Rexxy

**The modern, open-source, self-hostable Discord bot framework**

[![License: MIT](https://img.shields.io/badge/License-MIT-5865F2.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript)](https://www.typescriptlang.org)
[![Discord.js](https://img.shields.io/badge/Discord.js-14.x-5865F2?logo=discord)](https://discord.js.org)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

A powerful, modular alternative to MEE6, Dank Memer, and similar bots —
designed to be self-hosted, fully extensible, and contributor-friendly.

[**Get Started**](#-quick-start) · [**Plugins**](#-built-in-plugins) · [**Contributing**](#-contributing)

</div>

---

## ✨ Why Rexxy?

| Feature | MEE6 | Dank Memer | **Rexxy** |
|---|:---:|:---:|:---:|
| Open source | ❌ | ❌ | ✅ |
| Self-hostable | ❌ | ❌ | ✅ |
| Plugin system | ❌ | ❌ | ✅ |
| Slash + prefix commands | ✅ | ✅ | ✅ |
| Custom bot name/branding | ❌ | ❌ | ✅ |
| SQLite & PostgreSQL | ❌ | ❌ | ✅ |
| Docker support | ❌ | ❌ | ✅ |
| Contributor-friendly | ❌ | ❌ | ✅ |

---

## 🚀 Quick Start

You don't need to clone this repo. Run the interactive CLI generator:

```bash
npx create-guildbot
```

The wizard will ask you a few questions and scaffold a fully configured bot project in seconds:

```
  Welcome to Rexxy — the open-source modular Discord bot framework

  ? What do you want to name your bot instance? › MyBot
  ? Enter your Discord bot token: › ••••••••••••
  ? Command prefix for text commands: › !
  ? Which core plugins do you want enabled? › Moderation, Leveling, Logging
  ? Which database do you want to use? › SQLite
  ? Generate Docker support? › No
  ? Project directory name: › mybot-bot

  ✅  Your bot is ready! (powered by Rexxy)

  Next steps:
    1. cd mybot-bot
    2. npm install
    3. Review your .env file
    4. npm run dev
```

---

## 📦 Generated Project Structure

```
my-rexxy-bot/
├── src/
│   ├── index.ts                  ← Entry point
│   ├── core/
│   │   ├── RexxyClient.ts        ← Main Discord client wrapper
│   │   ├── CommandHandler.ts     ← Slash + prefix command router
│   │   ├── PluginLoader.ts       ← Dynamic plugin discovery & loading
│   │   ├── EventManager.ts       ← Discord event registration
│   │   ├── Database.ts           ← SQLite / PostgreSQL adapter
│   │   ├── Logger.ts             ← Coloured console logger
│   │   ├── ConfigManager.ts      ← Environment-driven config
│   │   └── types.ts              ← Shared TypeScript interfaces
│   └── plugins/
│       ├── moderation/index.ts
│       ├── leveling/index.ts
│       ├── economy/index.ts
│       └── logging/index.ts
├── config/
│   └── bot.config.ts             ← Static defaults & plugin config
├── scripts/
│   └── deploy-commands.ts        ← Re-register slash commands
├── .env                          ← Your secrets (never commit this)
├── .env.example
├── package.json
└── tsconfig.json
```

---

## 🔌 Built-in Plugins

### Moderation
Slash commands: `/ban`, `/kick`, `/warn`, `/timeout`, `/purge`
Permissions-aware, embed responses, expandable warn persistence.

### Leveling
XP per message with per-user/guild cooldown, level-up notifications,
`/rank` embed, `/leaderboard` top-10 list.

### Economy
Virtual currency with `/balance`, `/daily` (24-hour cooldown), `/give` transfers.
Fully persistent via the chosen database.

### Logging
Automatic audit log for member join/leave, message edits/deletes.
Posts to a channel named `#logs` or `#audit-log`.

---

## 🏗 Building Your Own Plugin

Create a folder under `src/plugins/my-plugin/` and export a `Plugin` object:

```ts
// src/plugins/my-plugin/index.ts
import { SlashCommandBuilder } from "discord.js";
import type { Plugin } from "../../core/types";

const plugin: Plugin = {
  name: "my-plugin",
  version: "1.0.0",
  description: "Does something awesome.",

  commands: [
    {
      name: "hello",
      description: "Say hello!",
      slashCommand: new SlashCommandBuilder()
        .setName("hello")
        .setDescription("Say hello!"),
      async execute(ctx) {
        await ctx.reply("👋 Hello from my-plugin!");
      },
    },
  ],

  events: [
    {
      event: "guildMemberAdd",
      async execute(member) {
        console.log(`${member.user.tag} joined!`);
      },
    },
  ],

  async onLoad(client) {
    client.logger.info("my-plugin loaded!");
  },
};

export default plugin;
```

Then add `my-plugin` to `ENABLED_PLUGINS` in your `.env` — that's it.

---

## 🗄 Database Support

| Engine | Use case | Config |
|---|---|---|
| **SQLite** | Small–medium servers, zero-ops | `DB_TYPE=sqlite` + `DB_PATH=./data/rexxy.db` |
| **PostgreSQL** | Large communities, production | `DB_TYPE=postgresql` + `DATABASE_URL=postgres://…` |

The database adapter runs migrations automatically on startup.

---

## 🐳 Docker

If you chose Docker during setup:

```bash
docker-compose up --build
```

For PostgreSQL the compose file includes a managed `postgres:16-alpine` service with health checks.

---

## ⚙️ Environment Variables

| Variable | Description | Default |
|---|---|---|
| `DISCORD_TOKEN` | Bot token from Discord Developer Portal | **required** |
| `BOT_NAME` | Display name for logs & messages | `Rexxy` |
| `COMMAND_PREFIX` | Text command prefix | `!` |
| `ENABLED_PLUGINS` | Comma-separated plugin IDs | *(chosen during setup)* |
| `DB_TYPE` | `sqlite` or `postgresql` | `sqlite` |
| `DB_PATH` | SQLite file path | `./data/rexxy.db` |
| `DATABASE_URL` | PostgreSQL connection string | — |
| `DEBUG` | Set to `1` for verbose debug logs | — |

---

## 🤝 Contributing

We welcome contributions of all sizes!

1. Fork this repository
2. Create a branch: `git checkout -b feat/my-feature`
3. Make your changes and add tests where applicable
4. Open a pull request

### Good first issues
- New plugin ideas (fun, music, tickets, polls…)
- Dashboard enhancements
- Documentation improvements
- Test coverage

---

## 📄 License

MIT — see [LICENSE](LICENSE).

---

<div align="center">

Built with ❤️ by the Rexxy community.
**Star ⭐ the repo if Rexxy saved you time!**

</div>
