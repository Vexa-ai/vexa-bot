#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const config_1 = require("./config/config");
const bot_core_1 = require("bot-core");
(function main() {
    const program = new commander_1.Command();
    program
        .option('-c, --config <path>', 'Path to the bot config file')
        .action(async () => {
        const options = program.opts();
        if (!options.config) {
            console.error('Error: --config or -c option is required');
            process.exit(1);
        }
        const config = (0, config_1.loadConfig)(options.config);
        if (!config.success) {
            console.error("invalid configuration:", config.error.message);
            process.exit(1);
        }
        try {
            await (0, bot_core_1.runBot)(config.data);
        }
        catch (error) {
            console.error('Failed to run bot:', error);
            process.exit(1);
        }
    });
    program.parse(process.argv);
})();
