# Vexa Bot 

## Prerequisites
- Node.js (v16 or higher) and npm
- Xvfb (X Virtual Framebuffer) for running in headless environments
  - Install on Ubuntu/Debian: `sudo apt-get install xvfb`
  - Install on CentOS/RHEL: `sudo yum install xvfb`

## Installation

### 1. Install Core Dependencies
First, build and install the core package:
```bash
# Navigate to the core directory
cd core

# Install dependencies
npm install

# Build the core package
npm run build
```

### 2. Install CLI Dependencies
Next, set up the CLI tool:
```bash
# Navigate to the cli directory
cd ../cli

# Install dependencies
npm install

# Make the dice script executable
chmod +x scripts/dice.sh
```

## Configuration
Create a configuration file in the `cli/configs` directory (e.g., `configs/meet-bot.json`):

```json
{
  "platform": "google",
  "meetingUrl": "https://meet.google.com/xxx-xxxx-xxx",
  "botName": "VexaBot",
  "token": "",
  "connectionId": "",
  "automaticLeave": {
    "waitingRoomTimeout": 300000,
    "noOneJoinedTimeout": 300000,
    "everyoneLeftTimeout": 300000
  }
}
```

### Configuration Options
- `platform`: Currently supports "google" for Google Meet
- `meetingUrl`: The full URL of the meeting to join
- `botName`: Name that will be displayed in the meeting
- `automaticLeave`: Timeouts in milliseconds for different scenarios
  - `waitingRoomTimeout`: How long to wait in the waiting room
  - `noOneJoinedTimeout`: How long to wait if no one joins
  - `everyoneLeftTimeout`: How long to stay after everyone leaves

## Running the Bot

### Using the Dice Command (Recommended)
The easiest way to run the bot is using the `dice.sh` script:

```bash
# Navigate to the cli directory
cd cli

# Run the bot with your config file
./scripts/dice.sh configs/meet-bot.json
```

### Manual Running (Alternative)
If you prefer to run the bot manually:

#### On Systems with Display
If you have a graphical environment:
```bash
npm run cli -- -c configs/meet-bot.json
```

#### On Headless Servers (without display)
For servers without a display, use Xvfb:
```bash
DISPLAY=:99 xvfb-run -a --server-args="-screen 0 1280x720x24" npm run cli -- -c configs/meet-bot.json
```

## Troubleshooting

### Common Issues
1. **X Server Error**: If you see "Missing X server or $DISPLAY", make sure to:
   - Use the `dice.sh` script which handles Xvfb configuration automatically
   - Or use `xvfb-run` on headless systems
   - Install Xvfb if not already installed

2. **Browser Launch Failed**: If the browser fails to launch:
   - Check if you're using the correct command for your environment (headless vs with display)
   - Ensure all dependencies are properly installed
   - Try running with elevated permissions if necessary

3. **Meeting Access Issues**: If the bot can't join the meeting:
   - Verify the meeting URL is correct and accessible
   - Check if the meeting requires authentication
   - Ensure the meeting allows external participants

### Debug Tips
- Check the browser debug screenshot at `meet-debug.png` if available
- Look for error messages in the console output
- Ensure all dependencies are properly installed and built
- Verify the configuration file is properly formatted JSON

## Development Notes
- The bot uses Playwright for browser automation
- All browser interactions are handled through the core package
- The CLI provides a simple interface to the core functionality
- The `dice.sh` script provides a convenient way to run the bot with proper Xvfb configuration 