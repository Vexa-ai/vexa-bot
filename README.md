# Vexa Bot 

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
  "meetingUrl": "https://meet.google.com/xxxx",
  "botName": "TestBot",
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
