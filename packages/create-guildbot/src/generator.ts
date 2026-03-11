/**
 * Project generator — scaffolds and updates Rexxy bot projects on disk.
 */

import chalk from "chalk";
import fs from "fs-extra";
import inquirer from "inquirer";
import ora from "ora";
import path from "path";
import type { BotConfig, PluginChoice, DatabaseChoice } from "./types";
import {
  getCoreTemplates,
  getPluginTemplates,
  getConfigTemplates,
  getDockerTemplates,
  getDashboardTemplates,
  getRootTemplates,
} from "./templates";

interface GeneratedFile {
  /** Path relative to the project root. */
  filePath: string;
  content: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Metadata stored at project root — used by the update command
// ─────────────────────────────────────────────────────────────────────────────

interface RexzyMeta {
  /** create-guildbot package version that generated this project. */
  generatorVersion: string;
  botName: string;
  prefix: string;
  plugins: PluginChoice[];
  database: DatabaseChoice;
  docker: boolean;
  dashboard: boolean;
  createdAt: string;
  /** Incremented each time `npx create-guildbot update` runs. */
  updateCount: number;
}

const META_FILE = ".rexzyrc.json";

// ─────────────────────────────────────────────────────────────────────────────
// Files the updater manages (framework infrastructure, never user code).
// Paths are relative to the project root.
// ─────────────────────────────────────────────────────────────────────────────

/** Core framework files — always included in an update run. */
const CORE_UPDATE_PATHS = new Set([
  "src/core/types.ts",
  "src/core/Logger.ts",
  "src/core/ConfigManager.ts",
  "src/core/Database.ts",
  "src/core/CommandHandler.ts",
  "src/core/EventManager.ts",
  "src/core/PluginLoader.ts",
  "src/core/RexxyClient.ts",
  "scripts/deploy-commands.ts",
]);

/** Dashboard framework files — included when the project has a dashboard. */
const DASHBOARD_UPDATE_PATHS = new Set([
  "dashboard/index.ts",
  "dashboard/routes/stats.ts",
  "dashboard/routes/commands.ts",
  "dashboard/routes/guilds.ts",
  "dashboard/public/index.html",
  // dashboard/routes/settings.ts intentionally skipped — user may customise it
]);

// ─────────────────────────────────────────────────────────────────────────────
// Create
// ─────────────────────────────────────────────────────────────────────────────

export async function generateProject(config: BotConfig): Promise<void> {
  const spinner = ora({
    text: chalk.cyan(`Creating project in ${chalk.bold(config.projectDir)}...`),
    color: "cyan",
  }).start();

  try {
    if (await fs.pathExists(config.projectDir)) {
      spinner.fail(
        chalk.red(
          `Directory ${chalk.bold(config.projectDir)} already exists. Please choose a different name.`
        )
      );
      process.exit(1);
    }

    await fs.ensureDir(config.projectDir);

    const files: GeneratedFile[] = [
      ...getRootTemplates(config),
      ...getCoreTemplates(config),
      ...getPluginTemplates(config),
      ...getConfigTemplates(config),
      ...(config.docker    ? getDockerTemplates(config)    : []),
      ...(config.dashboard ? getDashboardTemplates(config) : []),
    ];

    for (const file of files) {
      const fullPath = path.join(config.projectDir, file.filePath);
      await fs.ensureDir(path.dirname(fullPath));
      await fs.writeFile(fullPath, file.content, "utf8");
    }

    // Write metadata for future update runs
    await writeMeta(config.projectDir, config);

    spinner.succeed(chalk.green("Project files generated successfully!"));
    printSuccessMessage(config);
  } catch (err) {
    spinner.fail(chalk.red("Failed to generate project."));
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Update
// ─────────────────────────────────────────────────────────────────────────────

export async function updateProject(targetDir: string): Promise<void> {
  // ── 1. Read metadata ──────────────────────────────────────────────────────
  const metaPath = path.join(targetDir, META_FILE);
  if (!(await fs.pathExists(metaPath))) {
    console.log(
      chalk.red(`\n  ✖  No ${META_FILE} found in ${chalk.bold(targetDir)}.\n`) +
      chalk.gray(
        "  This directory was not created with create-guildbot, or the metadata\n" +
        "  file was deleted. Re-generate the project to restore it.\n"
      )
    );
    process.exit(1);
  }

  const meta: RexzyMeta = await fs.readJson(metaPath);

  // Reconstruct BotConfig (token is not stored — preserved from existing .env)
  const config: BotConfig = {
    botName:    meta.botName,
    token:      "<preserved>",   // never written during update
    prefix:     meta.prefix,
    plugins:    meta.plugins,
    database:   meta.database,
    docker:     meta.docker,
    dashboard:  meta.dashboard,
    projectDir: targetDir,
  };

  // ── 2. Build the freshly-rendered file set ────────────────────────────────
  const freshFiles = buildUpdateFiles(config);

  // ── 3. Diff against what's on disk ────────────────────────────────────────
  type FileStatus = "updated" | "new" | "unchanged";
  const results: Array<{ filePath: string; status: FileStatus }> = [];

  for (const file of freshFiles) {
    const fullPath = path.join(targetDir, file.filePath);
    if (!(await fs.pathExists(fullPath))) {
      results.push({ filePath: file.filePath, status: "new" });
    } else {
      const existing = await fs.readFile(fullPath, "utf8");
      results.push({
        filePath: file.filePath,
        status: existing === file.content ? "unchanged" : "updated",
      });
    }
  }

  const toWrite  = results.filter((r) => r.status !== "unchanged");
  const updated  = toWrite.filter((r) => r.status === "updated");
  const added    = toWrite.filter((r) => r.status === "new");

  // ── 4. Print summary ──────────────────────────────────────────────────────
  console.log();
  console.log(chalk.bold(`  ${chalk.hex("#5865F2")("⚡ Rexxy")} Update — ${chalk.bold(meta.botName)}`));
  console.log(chalk.gray(`  Generator version: ${packageVersion()}`));
  console.log();

  if (toWrite.length === 0) {
    console.log(chalk.green("  ✅  All framework files are already up to date."));
    console.log();
    return;
  }

  console.log(chalk.bold("  Files to update:"));
  console.log();

  for (const r of updated) {
    console.log(`  ${chalk.yellow("~")}  ${chalk.yellow(r.filePath)}`);
  }
  for (const r of added) {
    console.log(`  ${chalk.green("+")}  ${chalk.green(r.filePath)}`);
  }

  console.log();
  console.log(
    chalk.gray(
      "  The following are NEVER overwritten:\n" +
      "  src/plugins/, src/index.ts, .env, package.json,\n" +
      "  config/, dashboard/routes/settings.ts\n"
    )
  );

  // ── 5. Confirm ────────────────────────────────────────────────────────────
  const { confirm } = await inquirer.prompt<{ confirm: boolean }>([
    {
      type: "confirm",
      name: "confirm",
      message: chalk.cyan(
        `Apply ${toWrite.length} change(s) to framework files?`
      ),
      default: true,
    },
  ]);

  if (!confirm) {
    console.log(chalk.gray("\n  Update cancelled.\n"));
    return;
  }

  // ── 6. Write ──────────────────────────────────────────────────────────────
  const spinner = ora({ text: chalk.cyan("Applying updates…"), color: "cyan" }).start();

  try {
    for (const file of freshFiles) {
      const result = results.find((r) => r.filePath === file.filePath)!;
      if (result.status === "unchanged") continue;
      const fullPath = path.join(targetDir, file.filePath);
      await fs.ensureDir(path.dirname(fullPath));
      await fs.writeFile(fullPath, file.content, "utf8");
    }

    // Bump update counter in metadata
    await writeMeta(targetDir, config, meta.updateCount + 1);

    spinner.succeed(chalk.green(`Updated ${toWrite.length} file(s) successfully!`));

    console.log();
    console.log(chalk.bold("  Next steps:"));
    console.log();
    console.log(
      `  ${chalk.cyan("1.")} Review the updated files for any breaking changes.`
    );
    console.log(
      `  ${chalk.cyan("2.")} Run ${chalk.yellow("npm install")} to pick up any new dependencies.`
    );
    console.log(
      `  ${chalk.cyan("3.")} Restart your bot: ${chalk.yellow("npm run dev")}`
    );
    console.log();
    console.log(
      chalk.gray(
        "  Tip: commit the updates to git before restarting so you can\n" +
        "  easily roll back if something breaks.\n"
      )
    );
  } catch (err) {
    spinner.fail(chalk.red("Update failed."));
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Build the subset of generated files that the updater manages. */
function buildUpdateFiles(config: BotConfig): GeneratedFile[] {
  const all: GeneratedFile[] = [
    ...getCoreTemplates(config),
    ...(config.dashboard ? getDashboardTemplates(config) : []),
    ...getRootTemplates(config),   // included for scripts/deploy-commands.ts
  ];

  const allowed = new Set([
    ...CORE_UPDATE_PATHS,
    ...(config.dashboard ? DASHBOARD_UPDATE_PATHS : []),
  ]);

  return all.filter((f) => allowed.has(f.filePath));
}

async function writeMeta(
  projectDir: string,
  config: BotConfig,
  updateCount = 0,
): Promise<void> {
  const meta: RexzyMeta = {
    generatorVersion: packageVersion(),
    botName:   config.botName,
    prefix:    config.prefix,
    plugins:   config.plugins,
    database:  config.database,
    docker:    config.docker,
    dashboard: config.dashboard,
    createdAt: new Date().toISOString(),
    updateCount,
  };
  await fs.writeJson(path.join(projectDir, META_FILE), meta, { spaces: 2 });
}

function packageVersion(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return (require("../package.json") as { version: string }).version;
  } catch {
    return "unknown";
  }
}

function printSuccessMessage(config: BotConfig): void {
  const dirName = path.basename(config.projectDir);

  console.log();
  console.log(
    chalk.bold.green("✅  Your bot is ready!") +
      chalk.gray(` (powered by ${chalk.hex("#5865F2")("Rexxy")})`)
  );
  console.log();
  console.log(chalk.bold("  Next steps:"));
  console.log();
  console.log(`  ${chalk.cyan("1.")} Navigate into your project:`);
  console.log(`     ${chalk.yellow(`cd ${dirName}`)}`);
  console.log();
  console.log(`  ${chalk.cyan("2.")} Install dependencies:`);
  console.log(`     ${chalk.yellow("npm install")}`);
  console.log();
  console.log(
    `  ${chalk.cyan("3.")} Review your ${chalk.bold(".env")} file and confirm your bot token is correct.`
  );
  console.log();
  console.log(`  ${chalk.cyan("4.")} Start your bot:`);
  console.log(`     ${chalk.yellow("npm run dev")}`);
  console.log();
  if (config.docker) {
    console.log(`  ${chalk.cyan("5.")} Or run with Docker:`);
    console.log(`     ${chalk.yellow("docker compose up --build")}`);
    console.log();
  }
  console.log(
    chalk.gray(
      `  Need help? Check out https://github.com/rexxy-framework/rexxy or open an issue.\n`
    )
  );
  console.log(
    chalk.gray(
      `  To update framework files later, run inside your project:\n` +
      `  ${chalk.yellow("npx create-guildbot update")}\n`
    )
  );
}
