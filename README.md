# Vexa Bot 

## Prerequisites
- Node.js and npm
- Xvfb (X Virtual Framebuffer) for running in headless environments
  - Install on Ubuntu/Debian: `sudo apt-get install xvfb`
  - Install on CentOS/RHEL: `sudo yum install xvfb`

## Meet Bot CLI Tool  (Development, Testing)

## Install dependencies
Install Dependencies
### For Core
1.Navigate to the core directory and run:
```bash
npm install
```
2. Build the core:
```bash
npm run build
```

### For CLI
3. Navigate to the cli directory and run
```bash
npm install
```
4. Create a config file in JSON format (e.g., configs/meet-bot.json) like this:
```json
{
  "platform": "google",
  "meetingUrl": "https://meet.google.com/xxx-xxxx-xxx",
  "botName": "TestBot",
  "token": "",
  "connectionId": "",
  "automaticLeave": {
    "waitingRoomTimeout": 300000,
    "noOneJoinedTimeout": 300000,
    "everyoneLeftTimeout": 300000
  }
}
```
4. Run the CLI with:
```bash
npm run cli <config path>
```
example 
```bash
npm run cli configs/meet-bot.json
```
**Note: This is a temporary setup and I will improve it later.**

## Configuration
Create a config file in JSON format (e.g., configs/meet-bot.json):
```json
{
  "platform": "google",
  "meetingUrl": "https://meet.google.com/xxx-xxxx-xxx",
  "botName": "TestBot",
  "token": "",
  "connectionId": "",
  "automaticLeave": {
    "waitingRoomTimeout": 300000,
    "noOneJoinedTimeout": 300000,
    "everyoneLeftTimeout": 300000
  }
}
```

## Running the Bot
### On Systems with Display
```bash
npm run cli configs/meet-bot.json
```

### On Headless Servers (without display)
Using Xvfb to create a virtual display:
```bash
xvfb-run --server-args="-screen 0 1280x720x24" npm run cli configs/meet-bot.json
```

## Troubleshooting
- If the bot fails to interact with elements, check the debug screenshot at `meet-debug.png`
- For browser detection issues, you may need to update the anti-detection measures in `src/index.ts`
- If the bot fails to join, ensure the meeting URL is valid and accessible
