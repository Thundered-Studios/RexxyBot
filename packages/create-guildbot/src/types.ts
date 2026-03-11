/**
 * Configuration answers gathered during the Rexxy onboarding CLI.
 */
export interface BotConfig {
  /** Display name for this bot instance (e.g. "Rexxy", "MyBot"). */
  botName: string;
  /** Discord bot token. */
  token: string;
  /** Prefix for text-based commands (e.g. "!"). */
  prefix: string;
  /** Plugin IDs the user wants enabled by default. */
  plugins: PluginChoice[];
  /** Underlying database engine. */
  database: DatabaseChoice;
  /** Whether to generate Docker artefacts. */
  docker: boolean;
  /** Whether to scaffold a basic web dashboard. */
  dashboard: boolean;
  /** Target directory for the generated project. */
  projectDir: string;
}

export type PluginChoice =
  | "moderation"
  | "leveling"
  | "economy"
  | "logging"
  | "utility"
  | "welcome"
  | "reaction-roles";

export type DatabaseChoice = "sqlite" | "postgresql";
