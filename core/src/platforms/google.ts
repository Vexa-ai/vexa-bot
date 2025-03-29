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
  const alternateNameField = 'input[placeholder="Your name"]';
  const joinButton = '//button[.//span[text()="Ask to join"]]';
  const muteButton = '[aria-label*="Turn off microphone"]';
  const cameraOffButton = '[aria-label*="Turn off camera"]';

  // Add human-like behavior
  await page.mouse.move(10, 672);
  await page.mouse.move(102, 872);
  await page.waitForTimeout(randomDelay(300));
  await page.mouse.move(114, 100);
  await page.mouse.click(100, 100);

  log("Navigating to the meeting URL");
  await page.goto(meetingUrl, { waitUntil: "networkidle" });
  await page.bringToFront();

  // Add debugging to see page content
  log("Page loaded, taking screenshot and checking elements");
  await page.screenshot({ path: 'meet-debug.png' });
  
  log(`Page title: ${await page.title()}`);
  log("Checking for name field...");
  
  // Check if both selectors exist in the DOM
  const nameFieldExists = await page.$(enterNameField);
  const altFieldExists = await page.$(alternateNameField);
  log(`Name field exists: ${nameFieldExists !== null}, Alternate field exists: ${altFieldExists !== null}`);
  
  // Try to wait for the fields and handle errors
  let nameInput = null;
  
  log("Waiting for name input field to be visible...");
  // Try both selectors
  try {
    log("Trying with force-visibility approach");
    // Try to make elements visible using JavaScript
    await page.evaluate(() => {
      const inputs = document.querySelectorAll('input[type="text"]');
      inputs.forEach(input => {
        (input as HTMLElement).style.visibility = 'visible';
        (input as HTMLElement).style.display = 'block';
      });
    });
    
    await page.waitForTimeout(1000);
    
    // Try locator approach
    log("Using locator approach");
    const inputLocator = page.locator('input[type="text"]').first();
    await inputLocator.waitFor({ state: 'attached', timeout: 10000 });
    
    if (await inputLocator.count() > 0) {
      nameInput = inputLocator;
      log("Found input using locator approach");
      
      // Fill the name field
      log(`Filling name field with: ${botName}`);
      await inputLocator.fill(botName);
      await page.waitForTimeout(1000);
      
      // Try to trigger input event
      await page.evaluate((name) => {
        const inputs = document.querySelectorAll('input[type="text"]');
        inputs.forEach(input => {
          (input as HTMLInputElement).value = name;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        });
      }, botName);
      
      log("Name field filled");
    }
  } catch (e) {
    log(`Error with locator approach: ${e}`);
  }
  
  // If still not found, try alternate approaches
  if (!nameInput) {
    try {
      log("Trying alternative input approach");
      // Try using page.evaluate to find and fill the input
      const hasNameField = await page.evaluate((params) => {
        const input = document.querySelector(params.selector);
        if (input) {
          (input as HTMLInputElement).value = params.name;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }
        return false;
      }, { selector: enterNameField, name: botName });
      
      if (hasNameField) {
        log("Set name using JavaScript directly");
      } else {
        log("Could not find name field with JavaScript");
      }
    } catch (e) {
      log(`Error with JavaScript approach: ${e}`);
    }
  }
  
  // Wait for the button to be enabled after filling the name
  log("Waiting for join button to be enabled...");
  await page.waitForTimeout(2000);
  
  // Attempt to find and click join button
  log("Looking for join button");
  try {
    // Check if the button is disabled
    const buttonState = await page.evaluate(() => {
      const joinButtons = Array.from(document.querySelectorAll('button')).filter(btn => 
        btn.textContent && btn.textContent.includes("Ask to join")
      );
      
      const joinButton = joinButtons[0];
      if (joinButton) {
        return {
          exists: true,
          disabled: joinButton.hasAttribute('disabled'),
          text: joinButton.textContent
        };
      }
      return { exists: false };
    });
    
    log(`Join button state: ${JSON.stringify(buttonState)}`);
    
    if (buttonState.exists && buttonState.disabled) {
      log("Join button is disabled, trying to enable it");
      
      // Try to remove the disabled attribute
      await page.evaluate(() => {
        const joinButtons = Array.from(document.querySelectorAll('button')).filter(btn => 
          btn.textContent && btn.textContent.includes("Ask to join")
        );
        
        const joinButton = joinButtons[0];
        if (joinButton) {
          joinButton.removeAttribute('disabled');
        }
      });
      
      await page.waitForTimeout(1000);
    }
    
    // Wait for the join button to be visible
    await page.waitForSelector(joinButton, { timeout: 10000 });
    log("Join button found, clicking it");
    await page.click(joinButton);
    log(`${botName} requested to join the Meeting.`);
  } catch (e) {
    log(`Error finding or clicking join button: ${e}`);
    
    // Try one more approach - JavaScript click
    try {
      log("Trying to click using JavaScript");
      const clicked = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const joinButton = buttons.find(btn => 
          btn.textContent && btn.textContent.includes("Ask to join")
        );
        
        if (joinButton) {
          (joinButton as HTMLElement).click();
          return true;
        }
        return false;
      });
      
      if (clicked) {
        log("Successfully clicked join button using JavaScript");
      } else {
        throw new Error("Could not find or click join button");
      }
    } catch (e2) {
      log(`JavaScript click also failed: ${e2}`);
      throw new Error("Could not find or click join button");
    }
  }
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
