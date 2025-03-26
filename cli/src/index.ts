#!/usr/bin/env node
import { Command } from "commander";
import { loadConfig } from "./config/config";
import { runBot } from "bot-core";

(function main() {
  const program = new Command();
  program
    .option('-c, --config <path>', 'Path to the bot config file')
    .action(async () => {
      const options = program.opts();
      if (!options.config) {
        console.error('Error: --config or -c option is required');
        process.exit(1);
      }
      const config = loadConfig(options.config);
      if (!config.success) {
        console.error("invalid configuration:", config.error.message)
        process.exit(1);
      }
      try {
        await runBot(config.data)
      } catch (error) {
        console.error('Failed to run bot:', error);
        process.exit(1);
      }
    });

  program.parse(process.argv);
})()
