#!/bin/bash
# Start a virtual framebuffer in the background
Xvfb :99 -screen 0 1920x1080x24 &

# Finally, run the bot using the built production wrapper
# This wrapper (e.g., docker.js generated from docker.ts) will read the BOT_CONFIG env variable.
node dist/docker.js
