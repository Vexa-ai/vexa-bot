import { Page } from 'playwright';
import { log, randomDelay } from '../utils';
import { BotConfig } from '../types';

export async function handleGoogleMeet(botConfig: BotConfig, page: Page): Promise<void> {
  const leaveButton = `//button[@aria-label="Leave call"]`;

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
  // Expose the logBot function to the browser context
  await page.exposeFunction('logBot', (msg: string) => {
    log(msg);
  });

  await page.evaluate(
    async () => {
      const option = {
        token: "",
        language: "en",
        task: "",
        modelSize: "small",
        useVad: false,
      }

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

          let dt = new Date().getTime();
          const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = (dt + Math.random() * 16) % 16 | 0;
            dt = Math.floor(dt / 16);
            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
          });

          const wsUrl = "wss://whisperlive.dev.vexa.ai/websocket";
          const socket = new WebSocket(wsUrl);
          let isServerReady = false;
          let language = option.language;
          socket.onopen = function() {
            (window as any).logBot("WebSocket connection opened.");
            socket.send(
              JSON.stringify({
                uid: uuid,
                language: option.language,
                task: option.task,
                model: option.modelSize,
                use_vad: option.useVad
              })
            );
          };

          socket.onmessage = (event) => {
            (window as any).logBot("Received message: " + event.data);
            const data = JSON.parse(event.data);
            if (data["uid"] !== uuid) return;

            if (data["status"] === "WAIT") {
              (window as any).logBot(`Server busy: ${data["message"]}`);
              // Optionally stop recording here if required
            } else if (!isServerReady) {
              isServerReady = true;
              (window as any).logBot("Server is ready.");
            } else if (language === null && data["language"]) {
              (window as any).logBot(`Language detected: ${data["language"]}`);
            } else if (data["message"] === "DISCONNECT") {
              (window as any).logBot("Server requested disconnect.");
              socket.close()
            } else {
              (window as any).logBot(`Transcription: ${JSON.stringify(data)}`);
            }
          };

          socket.onclose = (event) => {
            (window as any).logBot(
              `WebSocket connection closed. Code: ${event.code}, Reason: ${event.reason}`
            );
          };

          const audioDataCache = [];
          const context = new AudioContext();
          const mediaStream = context.createMediaStreamSource(stream);
          const recorder = context.createScriptProcessor(4096, 1, 1);

          recorder.onaudioprocess = async (event) => {
            if (!context || !isServerReady) return;

            const inputData = event.inputBuffer.getChannelData(0);

            const data = new Float32Array(inputData);
            const targetLength = Math.round(data.length * (16000 / context.sampleRate));
            const resampledData = new Float32Array(targetLength);
            const springFactor = (data.length - 1) / (targetLength - 1);
            resampledData[0] = data[0];
            resampledData[targetLength - 1] = data[data.length - 1];
            for (let i = 1; i < targetLength - 1; i++) {
              const index = i * springFactor;
              const leftIndex = Math.floor(index);
              const rightIndex = Math.ceil(index);
              const fraction = index - leftIndex;
              resampledData[i] = data[leftIndex] + (data[rightIndex] - data[leftIndex]) * fraction;
            } audioDataCache.push(inputData);
            socket.send(resampledData);
          };

          mediaStream.connect(recorder);
          recorder.connect(context.destination);
          mediaStream.connect(context.destination);
          // Click the "People" button
          const peopleButton = document.querySelector('button[aria-label^="People"]');
          if (!peopleButton) {
            recorder.disconnect();
            return reject(new Error("[BOT Inner Error] 'People' button not found. Update the selector."));
          }
          (peopleButton as HTMLElement).click();

          // Monitor participant list every 5 seconds
          let aloneTime = 0;
          const checkInterval = setInterval(() => {
            const peopleList = document.querySelector('[role="list"]');
            if (!peopleList) {
              (window as any).logBot("Participant list not found; assuming meeting ended.");
              clearInterval(checkInterval);
              recorder.disconnect()
              resolve()
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
              recorder.disconnect();
              resolve()
            }
          }, 5000);

          // Listen for unload and visibility changes
          window.addEventListener("beforeunload", () => {
            (window as any).logBot("Page is unloading. Stopping recorder...");
            clearInterval(checkInterval);
            recorder.disconnect();
            resolve()
          });
          document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "hidden") {
              (window as any).logBot("Document is hidden. Stopping recorder...");
              clearInterval(checkInterval);
              recorder.disconnect();
              resolve()
            }
          });
        } catch (error: any) {
          return reject(new Error("[BOT Error] " + error.message));
        }
      });
    },
    {
      token,
      meetingUrl,
      connectionId
    }
  );
};
