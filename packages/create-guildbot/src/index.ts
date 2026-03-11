#!/usr/bin/env node
/**
 * create-guildbot — entry point
 *
 * Usage:
 *   npx create-guildbot            — interactive project wizard
 *   npx create-guildbot update     — update framework files in the current project
 */

import { runCLI, runUpdate } from "./cli";

const [subcommand] = process.argv.slice(2);

if (subcommand === "update") {
  runUpdate().catch((err: unknown) => {
    console.error("\n❌ Update failed:", err);
    process.exit(1);
  });
} else {
  runCLI().catch((err: unknown) => {
    console.error("\n❌ An unexpected error occurred:", err);
    process.exit(1);
  });
}
