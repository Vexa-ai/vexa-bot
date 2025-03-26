import { Page } from 'playwright';
import { log, randomDelay } from '../utils';
import { BotConfig } from '../types';

export async function handleGoogleMeet(botConfig: BotConfig, page: Page): Promise<void> {
  log('Handling Google Meet logic');
  await joinMeeting(page, botConfig.meetingUrl, botConfig.botName)
}

const joinMeeting = async (page: Page, meetingUrl: string, botName: string) => {
  const enterNameField = 'input[type="text"][aria-label="Your name"]';
  const joinButton = '//button[.//span[text()="Ask to join"]]';
  const muteButton = '[aria-label*="Turn off microphone"]';
  const cameraOffButton = '[aria-label*="Turn off camera"]';


  await page.mouse.move(10, 672);
  await page.mouse.move(102, 872);
  await page.mouse.move(114, 1472);
  await page.waitForTimeout(300);
  await page.mouse.move(114, 100);
  await page.mouse.click(100, 100);

  await page.goto(meetingUrl, { waitUntil: "networkidle" });
  await page.bringToFront();


  // Enter name and join
  await page.waitForTimeout(randomDelay(1000));
  await page.waitForSelector(enterNameField);

  await page.waitForTimeout(randomDelay(1000));
  await page.fill(enterNameField, botName);

  // Mute mic and camera if available
  try {
    await page.waitForTimeout(randomDelay(500));
    await page.click(muteButton, { timeout: 200 });
    await page.waitForTimeout(200);
  } catch (e) {
    log("Microphone already muted or not found.");
  }
  try {
    await page.waitForTimeout(randomDelay(500));
    await page.click(cameraOffButton, { timeout: 200 });
    await page.waitForTimeout(200);
  } catch (e) {
    log("Camera already off or not found.");
  }

  await page.waitForSelector(joinButton, { timeout: 60000 });
  await page.click(joinButton);
  log(`${botName} joined the Meeting.`);
}
