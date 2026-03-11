/**
 * Core framework templates — CommandHandler, PluginLoader, EventManager,
 * Database, Logger, ConfigManager, and shared types.
 */

import type { BotConfig } from "../types";

interface GeneratedFile {
  filePath: string;
  content: string;
}

export function getCoreTemplates(config: BotConfig): GeneratedFile[] {
  return [
    { filePath: "src/core/types.ts", content: coreTypes() },
    { filePath: "src/core/Logger.ts", content: logger(config) },
    { filePath: "src/core/ConfigManager.ts", content: configManager(config) },
    { filePath: "src/core/Database.ts", content: database(config) },
    { filePath: "src/core/CommandHandler.ts", content: commandHandler() },
    { filePath: "src/core/EventManager.ts", content: eventManager() },
    { filePath: "src/core/PluginLoader.ts", content: pluginLoader() },
    { filePath: "src/core/RexxyClient.ts", content: rexxyClient(config) },
  ];
}

// ---------------------------------------------------------------------------
// Shared Types
// ---------------------------------------------------------------------------
function coreTypes(): string {
  return `/**
 * Shared type definitions for the Rexxy framework.
 */

import type {
  ChatInputCommandInteraction,
  Client,
  Collection,
  Message,
} from "discord.js";

// ── Plugin ────────────────────────────────────────────────────────────────

export interface Plugin {
  /** Unique machine-readable identifier (e.g. "moderation"). */
  name: string;
  /** Human-readable version string (semver recommended). */
  version: string;
  /** Short description shown in help and logs. */
  description: string;
  /** Slash/prefix commands exposed by this plugin. */
  commands: Command[];
  /** Discord.js event handlers registered by this plugin. */
  events: EventHandler[];
  /** Called once when the plugin is loaded. */
  onLoad?: (client: RexxyClientInterface) => Promise<void>;
  /** Called once when the plugin is gracefully unloaded. */
  onUnload?: () => Promise<void>;
}

// ── Command ───────────────────────────────────────────────────────────────

/**
 * Accepts any discord.js slash command builder (v14+ compatible).
 *
 * discord.js v14 builder methods like .addUserOption() return the narrower
 * \`SlashCommandOptionsOnlyBuilder\` type rather than \`SlashCommandBuilder\`.
 * Using a structural duck type here avoids assignment errors while keeping
 * all the safety that matters — only \`toJSON()\` is called at runtime.
 *
 * To add a new command just build it normally; no casting is required.
 */
export type AnySlashCommandBuilder = {
  readonly name: string;
  readonly description: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toJSON(): any;
};

export interface Command {
  /** Command name (must be lowercase, no spaces). */
  name: string;
  /** Short description (used for slash command and help embed). */
  description: string;
  /** Legacy text-command aliases (e.g. ["mod", "m"]). */
  aliases?: string[];
  /**
   * Slash command builder — register the command as a Discord application
   * command. Any discord.js v14 builder is accepted (see \`AnySlashCommandBuilder\`).
   *
   * **Contributor tip:** Add new options by chaining the relevant .addXxxOption()
   * calls before passing the builder here.
   */
  slashCommand?: AnySlashCommandBuilder;
  /** Handles both slash-command and prefix-command invocations. */
  execute: (ctx: CommandContext) => Promise<void>;
}

export interface CommandContext {
  /** The underlying Discord.js client. */
  client: Client;
  /** Set when triggered by a slash command interaction. */
  interaction?: ChatInputCommandInteraction;
  /** Set when triggered by a text prefix command. */
  message?: Message;
  /** Parsed command arguments (from text message). */
  args: string[];
  /** Convenience reply helper — works for both interaction and message. */
  reply: (content: string) => Promise<void>;
}

// ── Event ─────────────────────────────────────────────────────────────────

export interface EventHandler<K extends string = string> {
  /** The Discord.js event name (e.g. "messageCreate", "guildMemberAdd"). */
  event: K;
  /** Whether to register with \`client.once\` instead of \`client.on\`. */
  once?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  execute: (...args: any[]) => Promise<void>;
}

// ── Client interface ──────────────────────────────────────────────────────

export interface RexxyClientInterface {
  readonly discord: Client;
  readonly config: BotConfiguration;
  readonly logger: LoggerInterface;
  readonly db: DatabaseInterface;
  /** All registered commands — useful for building help embeds in plugins. */
  readonly commands: Collection<string, Command>;
}

// ── Configuration ─────────────────────────────────────────────────────────

export interface BotConfiguration {
  botName: string;
  prefix: string;
  enabledPlugins: string[];
  database: {
    type: "sqlite" | "postgresql";
    path?: string;       // SQLite only
    url?: string;        // PostgreSQL only
  };
}

// ── Logger ────────────────────────────────────────────────────────────────

export interface LoggerInterface {
  info(message: string, ...meta: unknown[]): void;
  warn(message: string, ...meta: unknown[]): void;
  error(message: string, ...meta: unknown[]): void;
  debug(message: string, ...meta: unknown[]): void;
}

// ── Database ──────────────────────────────────────────────────────────────

export interface DatabaseInterface {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  /** Execute a raw query/statement (adapter-specific). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
}
`;
}

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------
function logger(config: BotConfig): string {
  return `/**
 * Logger — thin wrapper around console with coloured output.
 * Swap this out for winston / pino if you need file transports.
 */

import type { LoggerInterface } from "./types";

const RESET = "\\x1b[0m";
const BOLD  = "\\x1b[1m";
const CYAN  = "\\x1b[36m";
const YELLOW = "\\x1b[33m";
const RED    = "\\x1b[31m";
const GRAY   = "\\x1b[90m";

function timestamp(): string {
  return new Date().toISOString();
}

function prefix(level: string, color: string): string {
  return \`\${GRAY}[\${timestamp()}]\${RESET} \${color}\${BOLD}[\${level}]\${RESET}\`;
}

export class Logger implements LoggerInterface {
  private readonly scope: string;

  constructor(scope = "${config.botName}") {
    this.scope = scope;
  }

  info(message: string, ...meta: unknown[]): void {
    console.info(prefix("INFO", CYAN), \`[\${this.scope}]\`, message, ...meta);
  }

  warn(message: string, ...meta: unknown[]): void {
    console.warn(prefix("WARN", YELLOW), \`[\${this.scope}]\`, message, ...meta);
  }

  error(message: string, ...meta: unknown[]): void {
    console.error(prefix("ERR ", RED), \`[\${this.scope}]\`, message, ...meta);
  }

  debug(message: string, ...meta: unknown[]): void {
    if (process.env.DEBUG) {
      console.debug(prefix("DEBUG", GRAY), \`[\${this.scope}]\`, message, ...meta);
    }
  }

  child(scope: string): Logger {
    return new Logger(scope);
  }
}

export const logger = new Logger();
`;
}

// ---------------------------------------------------------------------------
// ConfigManager
// ---------------------------------------------------------------------------
function configManager(config: BotConfig): string {
  return `/**
 * ConfigManager — loads and validates bot configuration from environment
 * variables and the generated bot.config.ts file.
 */

import "dotenv/config";
import type { BotConfiguration } from "./types";

export function loadConfig(): BotConfiguration {
  const token = process.env.DISCORD_TOKEN;
  if (!token) {
    throw new Error(
      "DISCORD_TOKEN is not set. Please add it to your .env file."
    );
  }

  // Re-export token so the client can access it without re-reading .env.
  process.env.DISCORD_TOKEN = token;

  return {
    botName: process.env.BOT_NAME ?? "${config.botName}",
    prefix: process.env.COMMAND_PREFIX ?? "${config.prefix}",
    enabledPlugins: (process.env.ENABLED_PLUGINS ?? "${config.plugins.join(",")}")
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean),
    database: {
      type: (process.env.DB_TYPE as "sqlite" | "postgresql") ?? "${config.database}",
      path: process.env.DB_PATH ?? "./data/rexxy.db",
      url: process.env.DATABASE_URL,
    },
  };
}
`;
}

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------
function database(config: BotConfig): string {
  const isSqlite = config.database === "sqlite";

  return `/**
 * Database adapter — abstracts SQLite and PostgreSQL behind a common interface.
 *
 * SQLite:     Uses \`better-sqlite3\` (synchronous, zero-config).
 * PostgreSQL: Uses \`pg\` (async, connection-pool based).
 */

import type { BotConfiguration, DatabaseInterface } from "./types";
import { logger } from "./Logger";
${
  isSqlite
    ? `import BetterSqlite3 from "better-sqlite3";
import fs from "fs";
import path from "path";`
    : `import { Pool } from "pg";`
}

export class DatabaseAdapter implements DatabaseInterface {
  private config: BotConfiguration["database"];
${isSqlite ? `  private db?: BetterSqlite3.Database;` : `  private pool?: Pool;`}

  constructor(config: BotConfiguration["database"]) {
    this.config = config;
  }

  async connect(): Promise<void> {
${
  isSqlite
    ? `    const dbPath = this.config.path ?? "./data/rexxy.db";
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new BetterSqlite3(dbPath);
    this.db.pragma("journal_mode = WAL");
    logger.info(\`SQLite connected at \${dbPath}\`);
    this.runMigrations();`
    : `    if (!this.config.url) {
      throw new Error("DATABASE_URL is required for PostgreSQL.");
    }
    this.pool = new Pool({ connectionString: this.config.url });
    await this.pool.query("SELECT 1");
    logger.info("PostgreSQL connected.");
    await this.runMigrations();`
}
  }

  async disconnect(): Promise<void> {
${
  isSqlite
    ? `    this.db?.close();
    logger.info("SQLite connection closed.");`
    : `    await this.pool?.end();
    logger.info("PostgreSQL pool closed.");`
}
  }

  async query<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
${
  isSqlite
    ? `    if (!this.db) throw new Error("Database not connected.");
    const stmt = this.db.prepare(sql);
    // Use .run() for mutations, .all() for selects
    if (/^\\s*(INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)/i.test(sql)) {
      stmt.run(params);
      return [] as T[];
    }
    return stmt.all(params) as T[];`
    : `    if (!this.pool) throw new Error("Database not connected.");
    const result = await this.pool.query(sql, params);
    return result.rows as T[];`
}
  }

${
  isSqlite
    ? `  private runMigrations(): void {
    this.db?.exec(\`
      CREATE TABLE IF NOT EXISTS guild_configs (
        guild_id   TEXT PRIMARY KEY,
        config     TEXT NOT NULL DEFAULT '{}'
      );

      CREATE TABLE IF NOT EXISTS user_levels (
        user_id    TEXT NOT NULL,
        guild_id   TEXT NOT NULL,
        xp         INTEGER NOT NULL DEFAULT 0,
        level      INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (user_id, guild_id)
      );

      CREATE TABLE IF NOT EXISTS user_economy (
        user_id    TEXT NOT NULL,
        guild_id   TEXT NOT NULL,
        balance    INTEGER NOT NULL DEFAULT 0,
        last_daily TEXT,
        PRIMARY KEY (user_id, guild_id)
      );

      CREATE TABLE IF NOT EXISTS warnings (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id      TEXT NOT NULL,
        guild_id     TEXT NOT NULL,
        reason       TEXT NOT NULL,
        moderator_id TEXT NOT NULL,
        created_at   TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS welcome_configs (
        guild_id   TEXT PRIMARY KEY,
        channel_id TEXT NOT NULL,
        message    TEXT NOT NULL DEFAULT 'Welcome {user} to {server}! You are member #{membercount}.',
        enabled    INTEGER NOT NULL DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS reaction_roles (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id   TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        message_id TEXT NOT NULL,
        emoji      TEXT NOT NULL,
        role_id    TEXT NOT NULL,
        UNIQUE(message_id, emoji)
      );
    \`);
    logger.info("Database migrations complete.");
  }`
    : `  private async runMigrations(): Promise<void> {
    await this.query(\`
      CREATE TABLE IF NOT EXISTS guild_configs (
        guild_id   TEXT PRIMARY KEY,
        config     JSONB NOT NULL DEFAULT '{}'
      )
    \`);
    await this.query(\`
      CREATE TABLE IF NOT EXISTS user_levels (
        user_id    TEXT NOT NULL,
        guild_id   TEXT NOT NULL,
        xp         INTEGER NOT NULL DEFAULT 0,
        level      INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (user_id, guild_id)
      )
    \`);
    await this.query(\`
      CREATE TABLE IF NOT EXISTS user_economy (
        user_id    TEXT NOT NULL,
        guild_id   TEXT NOT NULL,
        balance    INTEGER NOT NULL DEFAULT 0,
        last_daily TIMESTAMPTZ,
        PRIMARY KEY (user_id, guild_id)
      )
    \`);
    await this.query(\`
      CREATE TABLE IF NOT EXISTS warnings (
        id           SERIAL PRIMARY KEY,
        user_id      TEXT NOT NULL,
        guild_id     TEXT NOT NULL,
        reason       TEXT NOT NULL,
        moderator_id TEXT NOT NULL,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    \`);
    await this.query(\`
      CREATE TABLE IF NOT EXISTS welcome_configs (
        guild_id   TEXT PRIMARY KEY,
        channel_id TEXT NOT NULL,
        message    TEXT NOT NULL DEFAULT 'Welcome {user} to {server}! You are member #{membercount}.',
        enabled    BOOLEAN NOT NULL DEFAULT TRUE
      )
    \`);
    await this.query(\`
      CREATE TABLE IF NOT EXISTS reaction_roles (
        id         SERIAL PRIMARY KEY,
        guild_id   TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        message_id TEXT NOT NULL,
        emoji      TEXT NOT NULL,
        role_id    TEXT NOT NULL,
        UNIQUE(message_id, emoji)
      )
    \`);
    logger.info("Database migrations complete.");
  }`
}
}
`;
}

// ---------------------------------------------------------------------------
// CommandHandler
// ---------------------------------------------------------------------------
function commandHandler(): string {
  return `/**
 * CommandHandler — registers application (slash) commands with Discord and
 * routes both slash-command interactions and prefix-based messages to the
 * correct plugin command handler.
 */

import {
  Client,
  Collection,
  Events,
  Message,
  REST,
  Routes,
  ChatInputCommandInteraction,
} from "discord.js";
import type { BotConfiguration, Command, CommandContext } from "./types";
import { logger } from "./Logger";

export class CommandHandler {
  /**
   * All registered commands keyed by their primary name.
   * Read-only from the outside — plugins may use this to build help embeds.
   */
  readonly commands = new Collection<string, Command>();
  /** Alias → primary name lookup. */
  private aliases = new Collection<string, string>();
  private config: BotConfiguration;
  private client: Client;

  constructor(client: Client, config: BotConfiguration) {
    this.client = client;
    this.config = config;
  }

  /** Register a command from a plugin. */
  register(command: Command): void {
    this.commands.set(command.name, command);
    command.aliases?.forEach((alias) => this.aliases.set(alias, command.name));
    logger.debug(\`Registered command: \${command.name}\`);
  }

  /** Push all slash commands to the Discord API. */
  async syncSlashCommands(token: string, clientId: string): Promise<void> {
    const rest = new REST({ version: "10" }).setToken(token);
    const slashPayloads = [...this.commands.values()]
      .filter((cmd) => cmd.slashCommand)
      .map((cmd) => cmd.slashCommand!.toJSON());

    if (slashPayloads.length === 0) return;

    logger.info(\`Syncing \${slashPayloads.length} slash command(s)…\`);
    await rest.put(Routes.applicationCommands(clientId), {
      body: slashPayloads,
    });
    logger.info("Slash commands synced.");
  }

  /** Attach interaction and message listeners to the Discord client. */
  attach(): void {
    this.client.on(Events.InteractionCreate, async (interaction) => {
      if (!interaction.isChatInputCommand()) return;
      await this.handleSlash(interaction);
    });

    this.client.on(Events.MessageCreate, async (message) => {
      await this.handleMessage(message);
    });
  }

  // ── Private helpers ───────────────────────────────────────────────────

  private async handleSlash(
    interaction: ChatInputCommandInteraction
  ): Promise<void> {
    const command = this.commands.get(interaction.commandName);
    if (!command) return;

    const ctx = this.buildContext({ interaction });
    try {
      await command.execute(ctx);
    } catch (err) {
      logger.error(\`Error in slash command /\${command.name}:\`, err);
      const msg = "An error occurred while executing that command.";
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: msg, ephemeral: true });
      } else {
        await interaction.reply({ content: msg, ephemeral: true });
      }
    }
  }

  private async handleMessage(message: Message): Promise<void> {
    if (message.author.bot) return;

    const prefix = this.config.prefix;
    if (!message.content.startsWith(prefix)) return;

    const [rawName, ...args] = message.content
      .slice(prefix.length)
      .trim()
      .split(/\\s+/);

    if (!rawName) return;

    const commandName = this.aliases.get(rawName.toLowerCase()) ?? rawName.toLowerCase();
    const command = this.commands.get(commandName);
    if (!command) return;

    const ctx = this.buildContext({ message, args });
    try {
      await command.execute(ctx);
    } catch (err) {
      logger.error(\`Error in prefix command \${prefix}\${command.name}:\`, err);
      await message.reply("An error occurred while executing that command.");
    }
  }

  private buildContext(opts: {
    interaction?: ChatInputCommandInteraction;
    message?: Message;
    args?: string[];
  }): CommandContext {
    const { interaction, message, args = [] } = opts;
    const client = this.client;

    const reply = async (content: string): Promise<void> => {
      if (interaction) {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(content);
        } else {
          await interaction.reply(content);
        }
      } else if (message) {
        await message.reply(content);
      }
    };

    return { client, interaction, message, args, reply };
  }
}
`;
}

// ---------------------------------------------------------------------------
// EventManager
// ---------------------------------------------------------------------------
function eventManager(): string {
  return `/**
 * EventManager — registers plugin event handlers on the Discord.js client.
 */

import type { Client } from "discord.js";
import type { EventHandler } from "./types";
import { logger } from "./Logger";

export class EventManager {
  private client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  /** Register a single event handler from a plugin. */
  register(handler: EventHandler): void {
    const fn = async (...args: unknown[]) => {
      try {
        await handler.execute(...args);
      } catch (err) {
        logger.error(\`Unhandled error in event "\${handler.event}":\`, err);
      }
    };

    if (handler.once) {
      this.client.once(handler.event, fn);
    } else {
      this.client.on(handler.event, fn);
    }

    logger.debug(
      \`Registered event: \${handler.event}\${handler.once ? " (once)" : ""}\`
    );
  }
}
`;
}

// ---------------------------------------------------------------------------
// PluginLoader
// ---------------------------------------------------------------------------
function pluginLoader(): string {
  return `/**
 * PluginLoader — dynamically imports plugins from src/plugins/ and wires
 * their commands and event handlers into the framework.
 */

import path from "path";
import fs from "fs";
import type { Plugin } from "./types";
import type { RexxyClient } from "./RexxyClient";
import { logger } from "./Logger";

export class PluginLoader {
  private client: RexxyClient;
  /** All currently loaded plugins, keyed by name. */
  private loaded = new Map<string, Plugin>();

  constructor(client: RexxyClient) {
    this.client = client;
  }

  /** Load all enabled plugins from the plugins directory. */
  async loadAll(): Promise<void> {
    const pluginsDir = path.join(__dirname, "..", "plugins");
    const enabledPlugins = this.client.config.enabledPlugins;

    if (!fs.existsSync(pluginsDir)) {
      logger.warn("Plugins directory not found — skipping plugin load.");
      return;
    }

    const entries = fs.readdirSync(pluginsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (!enabledPlugins.includes(entry.name)) {
        logger.debug(\`Plugin "\${entry.name}" is disabled — skipping.\`);
        continue;
      }
      await this.loadPlugin(entry.name, path.join(pluginsDir, entry.name));
    }

    logger.info(
      \`Loaded \${this.loaded.size} plugin(s): \${[...this.loaded.keys()].join(", ")}\`
    );
  }

  private async loadPlugin(name: string, pluginPath: string): Promise<void> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require(pluginPath) as { default?: Plugin; plugin?: Plugin };
      const plugin: Plugin = mod.default ?? (mod as unknown as Plugin);

      if (!plugin?.name || !Array.isArray(plugin.commands)) {
        logger.warn(
          \`Plugin "\${name}" does not export a valid Plugin object — skipping.\`
        );
        return;
      }

      // Register commands
      for (const command of plugin.commands) {
        this.client.commandHandler.register(command);
      }

      // Register event handlers
      for (const handler of plugin.events) {
        this.client.eventManager.register(handler);
      }

      // Call optional lifecycle hook
      if (plugin.onLoad) {
        await plugin.onLoad(this.client);
      }

      this.loaded.set(plugin.name, plugin);
      logger.info(\`Plugin loaded: \${plugin.name} v\${plugin.version}\`);
    } catch (err) {
      logger.error(\`Failed to load plugin "\${name}":\`, err);
    }
  }

  /** Gracefully unload all loaded plugins. */
  async unloadAll(): Promise<void> {
    for (const [name, plugin] of this.loaded) {
      try {
        if (plugin.onUnload) await plugin.onUnload();
        logger.info(\`Plugin unloaded: \${name}\`);
      } catch (err) {
        logger.error(\`Error unloading plugin "\${name}":\`, err);
      }
    }
    this.loaded.clear();
  }
}
`;
}

// ---------------------------------------------------------------------------
// RexxyClient
// ---------------------------------------------------------------------------
function rexxyClient(config: BotConfig): string {
  return `/**
 * RexxyClient — the main Discord client that ties all framework systems together.
 */

import { Client, Collection, GatewayIntentBits, Partials } from "discord.js";
import type {
  BotConfiguration,
  Command,
  DatabaseInterface,
  LoggerInterface,
  RexxyClientInterface,
} from "./types";
import { Logger } from "./Logger";
import { loadConfig } from "./ConfigManager";
import { DatabaseAdapter } from "./Database";
import { CommandHandler } from "./CommandHandler";
import { EventManager } from "./EventManager";
import { PluginLoader } from "./PluginLoader";

export class RexxyClient implements RexxyClientInterface {
  readonly discord: Client;
  readonly config: BotConfiguration;
  readonly logger: LoggerInterface;
  readonly db: DatabaseInterface;
  readonly commandHandler: CommandHandler;
  readonly eventManager: EventManager;
  readonly pluginLoader: PluginLoader;

  constructor() {
    this.config = loadConfig();
    this.logger = new Logger(this.config.botName);
    this.discord = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessageReactions,
      ],
      partials: [
        Partials.Message,
        Partials.Channel,
        Partials.GuildMember,
        Partials.Reaction,
      ],
    });

    this.db = new DatabaseAdapter(this.config.database);
    this.commandHandler = new CommandHandler(this.discord, this.config);
    this.eventManager = new EventManager(this.discord);
    this.pluginLoader = new PluginLoader(this);
  }

  /** All registered commands — satisfies RexxyClientInterface. */
  get commands(): Collection<string, Command> {
    return this.commandHandler.commands;
  }

  /** Start the bot: connect DB → load plugins → login to Discord. */
  async start(): Promise<void> {
    const token = process.env.DISCORD_TOKEN!;

    this.logger.info(\`Starting \${this.config.botName} (powered by Rexxy)…\`);

    // Connect to the database
    await this.db.connect();

    // Load all enabled plugins
    await this.pluginLoader.loadAll();

    // Attach the command router
    this.commandHandler.attach();

    // Login
    await this.discord.login(token);
    this.logger.info(\`\${this.config.botName} is online! 🚀\`);

    // Sync slash commands after ready
    this.discord.once("ready", async () => {
      await this.commandHandler.syncSlashCommands(
        token,
        this.discord.user!.id
      );
    });
  }

  /** Gracefully shut down the bot. */
  async stop(): Promise<void> {
    this.logger.info("Shutting down…");
    await this.pluginLoader.unloadAll();
    await this.db.disconnect();
    this.discord.destroy();
  }
}
`;
}
