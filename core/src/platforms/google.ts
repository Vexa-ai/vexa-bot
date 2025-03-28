import { Page } from 'playwright';
import { log, randomDelay } from '../utils';
import { BotConfig } from '../types';

const leaveButton = `//button[@aria-label="Leave call"]`;

export async function handleGoogleMeet(botConfig: BotConfig, page: Page): Promise<void> {
  log('Joining Google Meet');
  try {
    await joinMeeting(page, botConfig.meetingUrl, botConfig.botName)
  } catch (error: any) {
    console.error(error.message)
    return
  }

  log("Waiting to admit to the meeting")
  try {
    await page.waitForSelector(leaveButton, {
      timeout: botConfig.automaticLeave.waitingRoomTimeout,
    });
  } catch {
    console.error("Bot was not admitted into the meeting")
    return;
  }

  log("Start Recording the meeting")
  try {
    await recordMeeting(page, botConfig.meetingUrl, botConfig.token, botConfig.connectionId);
  } catch (error: any) {
    console.error(error.message)
    return
  }


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

const recordMeeting = async (page: Page, meetingUrl: string, token: string, connectionId: string) => {
  const meetingId = meetingUrl.split("?")[0].split("/").pop();
  const ts = Math.floor(new Date().getTime() / 1000);

  await page.exposeFunction('logBot', (msg: string) => {
    log(msg);
  });


  await page.evaluate(
    async () => {
      await new Promise<void>((resolve, reject) => {
        try {
          (window as any).logBot("Starting recording process.");
          const mediaElements = Array.from(document.querySelectorAll("audio, video")).filter(
            (el: any) => !el.paused
          );
          if (mediaElements.length === 0) {
            return reject(new Error("[BOT Error] No active media elements found. Ensure the meeting media is playing."));
          }
          const element: any = mediaElements[0];

          const stream = element.srcObject || element.captureStream();
          if (!(stream instanceof MediaStream)) {
            return reject(new Error("[BOT Error] Unable to obtain a MediaStream from the media element."));
          }

          const audioContext = new AudioContext();
          audioContext.resume().catch((err) => reject(new Error("[BOT Error] AudioContext resume failed: " + err.message)));

          const recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
          const chunks: BlobPart[] = [];

          recorder.ondataavailable = (event: BlobEvent) => {
            if (event.data.size > 0) {
              chunks.push(event.data);
            }
          };

          recorder.onerror = (error) => {
            recorder.stop();
            return reject(new Error("[BOT Recorder Error] " + error.message));
          };

          recorder.onstop = async () => {
            (window as any).logBot("Recorder stopped. Preparing upload...");

            if (chunks.length === 0) {
              (window as any).logBot("[BOT Warning] No recorded audio data available. Skipping upload.");
            } else {
              try {
                const blob = new Blob(chunks, { type: "audio/webm;codecs=opus" });

                const uploadUrl = `https://transcription.dev.vexa.ai/api/v1/extension/audio?meeting_id=${meetingId}&connection_id=${connectionId}&token=${token}&ts=${ts}&l=1`;
                const res = await fetch(uploadUrl, {
                  method: "PUT",
                  body: blob,
                  headers: { "Content-Type": "application/octet-stream" },
                });

                if (!res.ok) {
                  return reject(new Error("[BOT Upload Error] Failed to upload audio file. Server responded with status: " + res.status));
                }

                (window as any).logBot("Recording successfully uploaded.");
              } catch (error: any) {
                (window as any).logBot("[BOT Error] Failed to process the recorded audio: " + error.message);
              }
            }

            // Leave the meeting
            const leaveBtn = document.querySelector('button[aria-label="Leave call"]');
            if (leaveBtn) {
              (leaveBtn as HTMLElement).click();
              (window as any).logBot("Leave button clicked. Exiting meeting.");
            } else {
              (window as any).logBot("Leave button not found. Meeting might have already ended.");
            }

            resolve();
          };
          recorder.start();
          (window as any).logBot("Recorder started.");

          // Click the "People" button.
          const peopleButton = document.querySelector('button[aria-label^="People"]');
          if (!peopleButton) {
            recorder.stop();
            return reject(new Error("[BOT Inner Error] 'People' button not found. Update the selector."));
          }
          (peopleButton as HTMLElement).click();

          // Monitor participant list every 5 seconds.
          let aloneTime = 0;
          const checkInterval = setInterval(() => {
            const peopleList = document.querySelector('[role="list"]');
            if (!peopleList) {
              (window as any).logBot("Participant list not found; assuming meeting ended.");
              clearInterval(checkInterval);
              recorder.stop();
              return;
            }
            const count = peopleList.childElementCount;
            (window as any).logBot("Participant count: " + count);

            if (count <= 1) {
              aloneTime += 5;
              (window as any).logBot("Bot appears alone for " + aloneTime + " seconds...");
            } else {
              aloneTime = 0;
            }

            if (aloneTime >= 10 || count === 0) {
              (window as any).logBot("Meeting ended or bot alone for too long. Stopping recorder...");
              clearInterval(checkInterval);
              recorder.stop();
            }
          }, 5000);

          // Listen for unload and visibility changes.
          window.addEventListener("beforeunload", () => {
            (window as any).logBot("Page is unloading. Stopping recorder...");
            clearInterval(checkInterval);
            recorder.stop();
          });
          document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "hidden") {
              (window as any).logBot("Document is hidden. Stopping recorder...");
              clearInterval(checkInterval);
              recorder.stop();
            }
          });
        } catch (error: any) {
          return reject(new Error("[BOT Error] " + error.message));
        }
      });
    },
  );
};
