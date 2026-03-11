#!/usr/bin/env node
/**
 * create-guildbot – entry point
 *
 * Run with:  npx create-guildbot
 */

import { runCLI } from "./cli";

runCLI().catch((err: unknown) => {
  console.error("\n❌ An unexpected error occurred:", err);
  process.exit(1);
});
