/**
 * Interactive CLI prompts for the Rexxy project generator.
 */

import chalk from "chalk";
import inquirer from "inquirer";
import path from "path";
import { generateProject, updateProject } from "./generator";
import type { BotConfig, DatabaseChoice, PluginChoice } from "./types";

const REXXY_BANNER = `
${chalk.bold.hex("#5865F2")("██████╗ ███████╗██╗  ██╗██╗  ██╗██╗   ██╗")}
${chalk.bold.hex("#5865F2")("██╔══██╗██╔════╝╚██╗██╔╝╚██╗██╔╝╚██╗ ██╔╝")}
${chalk.bold.hex("#5865F2")("██████╔╝█████╗   ╚███╔╝  ╚███╔╝  ╚████╔╝ ")}
${chalk.bold.hex("#5865F2")("██╔══██╗██╔══╝   ██╔██╗  ██╔██╗   ╚██╔╝  ")}
${chalk.bold.hex("#5865F2")("██║  ██║███████╗██╔╝ ██╗██╔╝ ██╗   ██║   ")}
${chalk.bold.hex("#5865F2")("╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝   ")}
`;

export async function runCLI(): Promise<void> {
  console.clear();
  console.log(REXXY_BANNER);
  console.log(
    chalk.bold.white("  Welcome to ") +
      chalk.bold.hex("#5865F2")("Rexxy") +
      chalk.bold.white(" — the open-source modular Discord bot framework\n")
  );
  console.log(
    chalk.gray(
      "  This wizard will create a fully configured bot project tailored to your needs.\n" +
        "  Each server owner runs their own instance — Rexxy is the engine under the hood.\n"
    )
  );

  const answers = await inquirer.prompt<{
    botName: string;
    token: string;
    prefix: string;
    plugins: PluginChoice[];
    database: DatabaseChoice;
    docker: boolean;
    dashboard: boolean;
    projectDir: string;
  }>([
    {
      type: "input",
      name: "botName",
      message: chalk.cyan("What do you want to name your bot instance?"),
      default: "Rexxy",
      validate: (input: string) =>
        input.trim().length > 0 ? true : "Bot name cannot be empty.",
    },
    {
      type: "input",
      name: "token",
      message: chalk.cyan("Enter your Discord bot token:"),
      validate: (input: string) =>
        input.trim().length > 0
          ? true
          : "Token is required. You can update it later in the .env file.",
    },
    {
      type: "input",
      name: "prefix",
      message: chalk.cyan("Command prefix for text commands:"),
      default: "!",
      validate: (input: string) =>
        input.trim().length > 0 ? true : "Prefix cannot be empty.",
    },
    {
      type: "checkbox",
      name: "plugins",
      message: chalk.cyan("Which core plugins do you want enabled?"),
      choices: [
        {
          name: `${chalk.bold("Utility")}         — ping, help, serverinfo, userinfo, avatar, invite`,
          value: "utility",
          checked: true,
        },
        {
          name: `${chalk.bold("Moderation")}      — ban, kick, mute, warn, warnings, clear, slowmode`,
          value: "moderation",
          checked: true,
        },
        {
          name: `${chalk.bold("Leveling")}        — XP system, rank, leaderboard`,
          value: "leveling",
          checked: true,
        },
        {
          name: `${chalk.bold("Economy")}         — currency, daily rewards, give`,
          value: "economy",
          checked: false,
        },
        {
          name: `${chalk.bold("Logging")}         — audit log, join/leave, message events`,
          value: "logging",
          checked: true,
        },
        {
          name: `${chalk.bold("Welcome")}         — configurable welcome messages with placeholders`,
          value: "welcome",
          checked: false,
        },
        {
          name: `${chalk.bold("Reaction Roles")}  — self-assignable roles via message reactions`,
          value: "reaction-roles",
          checked: false,
        },
      ],
    },
    {
      type: "list",
      name: "database",
      message: chalk.cyan("Which database do you want to use?"),
      choices: [
        {
          name: `${chalk.bold("SQLite")}      — zero-config, perfect for small servers`,
          value: "sqlite",
        },
        {
          name: `${chalk.bold("PostgreSQL")}  — production-ready, great for large communities`,
          value: "postgresql",
        },
      ],
      default: "sqlite",
    },
    {
      type: "confirm",
      name: "docker",
      message: chalk.cyan("Generate Docker support (Dockerfile + docker-compose)?"),
      default: false,
    },
    {
      type: "confirm",
      name: "dashboard",
      message: chalk.cyan("Scaffold a basic web dashboard?"),
      default: false,
    },
    {
      type: "input",
      name: "projectDir",
      message: chalk.cyan("Project directory name:"),
      default: (answers: { botName: string }) =>
        answers.botName.toLowerCase().replace(/\s+/g, "-") + "-bot",
      validate: (input: string) =>
        input.trim().length > 0 ? true : "Directory name cannot be empty.",
    },
  ]);

  const config: BotConfig = {
    botName: answers.botName.trim(),
    token: answers.token.trim(),
    prefix: answers.prefix.trim(),
    plugins: answers.plugins,
    database: answers.database,
    docker: answers.docker,
    dashboard: answers.dashboard,
    projectDir: path.resolve(process.cwd(), answers.projectDir.trim()),
  };

  console.log();
  await generateProject(config);
}

export async function runUpdate(): Promise<void> {
  console.clear();
  console.log(REXXY_BANNER);
  console.log(
    chalk.bold.white("  ") +
      chalk.bold.hex("#5865F2")("Rexxy") +
      chalk.bold.white(" — Framework Updater\n")
  );
  console.log(
    chalk.gray(
      "  This will update your project's core framework files to the latest\n" +
      "  templates while preserving all of your custom code and configuration.\n"
    )
  );

  const targetDir = process.cwd();
  await updateProject(targetDir);
}
