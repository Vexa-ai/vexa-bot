#!/bin/bash

# Check if config file is provided
if [ -z "$1" ]; then
    echo "Usage: ./dice.sh <config-file>"
    echo "Example: ./dice.sh configs/meet-bot.json"
    exit 1
fi

# Check if config file exists
if [ ! -f "$1" ]; then
    echo "Error: Config file '$1' not found"
    exit 1
fi

# Run the bot with Xvfb
DISPLAY=:99 xvfb-run -a --server-args="-screen 0 1280x720x24" npm run cli -- -c "$1" 