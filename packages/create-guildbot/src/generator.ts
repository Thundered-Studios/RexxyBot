/**
 * Project generator — scaffolds the full Rexxy bot project on disk.
 */

import chalk from "chalk";
import fs from "fs-extra";
import ora from "ora";
import path from "path";
import type { BotConfig } from "./types";
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

export async function generateProject(config: BotConfig): Promise<void> {
  const spinner = ora({
    text: chalk.cyan(`Creating project in ${chalk.bold(config.projectDir)}...`),
    color: "cyan",
  }).start();

  try {
    // Ensure target directory doesn't already exist
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
      ...(config.docker ? getDockerTemplates(config) : []),
      ...(config.dashboard ? getDashboardTemplates(config) : []),
    ];

    for (const file of files) {
      const fullPath = path.join(config.projectDir, file.filePath);
      await fs.ensureDir(path.dirname(fullPath));
      await fs.writeFile(fullPath, file.content, "utf8");
    }

    spinner.succeed(chalk.green("Project files generated successfully!"));
    printSuccessMessage(config);
  } catch (err) {
    spinner.fail(chalk.red("Failed to generate project."));
    throw err;
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
    console.log(`     ${chalk.yellow("docker-compose up --build")}`);
    console.log();
  }
  console.log(
    chalk.gray(
      `  Need help? Check out https://github.com/rexxy-framework/rexxy or open an issue.\n`
    )
  );
}
