import { Page } from 'playwright';
import { log, randomDelay } from '../utils';
import { BotConfig } from '../types';

export async function handleGoogleMeet(botConfig: BotConfig, page: Page): Promise<void> {
  const participantsButton = 'button[data-testid="toolbar.participants"]'; // Participants panel button

  log('Handling Google Meet logic');
  await joinMeeting(page, botConfig.meetingUrl, botConfig.botName)
  console.log('Starting recording...');
  await recordMeeting(page);
  await page.waitForSelector(participantsButton, {
    timeout: botConfig.automaticLeave.waitingRoomTimeout,
  });

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

async function recordMeeting(page: Page) {
  await page.evaluate(async () => {
    const mediaElements = Array.from(document.querySelectorAll('audio, video')).filter(
      (el: any) => !el.paused
    );
    if (mediaElements.length === 0) {
      throw new Error('No playing media elements found in the meeting page');
    }
    const element: any = mediaElements[0];
    const stream = element.srcObject || element.captureStream();

    if (!(stream instanceof MediaStream)) {
      throw new Error('Unable to obtain a MediaStream from the media element');
    }

    const audioContext = new AudioContext();
    await audioContext.resume();

    const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
    const chunks: BlobPart[] = [];

    recorder.ondataavailable = async (event: BlobEvent) => {
      try {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }

      } catch (error) {
        console.error('Error processing data available event:', error);
      }
    }

    recorder.onerror = (error) => {
      console.error(error);
      recorder.stop();
    };

    recorder.onstop = async () => {
      const blob = new Blob(chunks, { type: 'audio/webm;codecs=opus' });
      //todo: fix the url 
      const res = await fetch("/api/v1/extension/audio", {
        method: 'PUT',
        body: blob,
        headers: {
          'Content-Type': 'application/octet-stream'
        }
      })
      if (!res.ok) {
        throw new Error("Error sending Audio File")
      }

    };

    recorder.start();
  })
}
