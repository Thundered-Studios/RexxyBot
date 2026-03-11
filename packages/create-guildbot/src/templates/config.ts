/**
 * Bot config file template (config/bot.config.ts).
 */

import type { BotConfig } from "../types";

interface GeneratedFile {
  filePath: string;
  content: string;
}

export function getConfigTemplates(config: BotConfig): GeneratedFile[] {
  return [
    {
      filePath: "config/bot.config.ts",
      content: botConfig(config),
    },
  ];
}

function botConfig(config: BotConfig): string {
  return `/**
 * Static bot configuration.
 * Most values are overridable via environment variables — see .env.
 *
 * This file is useful for defining plugin-specific defaults, role IDs,
 * channel IDs, or anything you don't want to put in an environment variable.
 */

export const botConfig = {
  /** Display name of this bot instance. */
  botName: process.env.BOT_NAME ?? "${config.botName}",

  /** Command prefix for text-based commands. */
  prefix: process.env.COMMAND_PREFIX ?? "${config.prefix}",

  /** Plugin IDs that should be loaded on startup. */
  enabledPlugins: (process.env.ENABLED_PLUGINS ?? "${config.plugins.join(",")}")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean),

  /** Database settings. */
  database: {
    type: (process.env.DB_TYPE as "sqlite" | "postgresql") ?? "${config.database}",
    /** SQLite database path (only used when type = "sqlite"). */
    path: process.env.DB_PATH ?? "./data/rexxy.db",
    /** PostgreSQL connection string (only used when type = "postgresql"). */
    url: process.env.DATABASE_URL,
  },

  /**
   * Per-plugin configuration defaults.
   * Plugins read from here at load-time; server admins can override via
   * slash commands or a web dashboard.
   */
  plugins: {
    moderation: {
      /** Log moderation actions to this channel name (if it exists). */
      logChannelName: "mod-log",
    },
    leveling: {
      /** XP awarded per message (random between min and max). */
      xpMin: 15,
      xpMax: 25,
      /** Cooldown in seconds between XP awards per user. */
      cooldownSeconds: 60,
    },
    economy: {
      /** Coins awarded by the /daily command. */
      dailyAmount: 100,
      /** Currency display name. */
      currencyName: "coins",
      currencyEmoji: "💰",
    },
    logging: {
      /** Channel name prefix used to find the log channel. */
      logChannelKeyword: "logs",
    },
  },
} as const;
`;
}
