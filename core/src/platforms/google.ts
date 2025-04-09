import { Page } from 'playwright';
import { log, randomDelay } from '../utils';
import { BotConfig } from '../types';

export async function handleGoogleMeet(botConfig: BotConfig, page: Page): Promise<void> {
  const leaveButton = `//button[@aria-label="Leave call"]`;

  if (!botConfig.meetingUrl) {
    log('Error: Meeting URL is required for Google Meet but is null.');
    return;
  }

  log('Joining Google Meet');
  try {
    await joinMeeting(page, botConfig.meetingUrl, botConfig.botName)
  } catch (error: any) {
    console.error(error.message)
    return
  }

  // Setup websocket connection and meeting admission concurrently
  log("Starting WebSocket connection while waiting for meeting admission");
  try {
    // Run both processes concurrently
    const [isAdmitted] = await Promise.all([
      // Wait for admission to the meeting
      waitForMeetingAdmission(page, leaveButton, botConfig.automaticLeave.waitingRoomTimeout)
        .catch(error => {
          log("Meeting admission failed: " + error.message);
          return false;
        }),
      
      // Prepare for recording (expose functions, etc.) while waiting for admission
      prepareForRecording(page)
    ]);

    if (!isAdmitted) {
      console.error("Bot was not admitted into the meeting");
      return;
    }

    log("Successfully admitted to the meeting, starting recording");
    // Pass platform from botConfig to startRecording
    await startRecording(page, botConfig);
  } catch (error: any) {
    console.error(error.message)
    return
  }
}

// New function to wait for meeting admission
const waitForMeetingAdmission = async (page: Page, leaveButton: string, timeout: number): Promise<boolean> => {
  try {
    await page.waitForSelector(leaveButton, { timeout });
    log("Successfully admitted to the meeting");
    return true;
  } catch {
    throw new Error("Bot was not admitted into the meeting within the timeout period");
  }
};

// Prepare for recording by exposing necessary functions
const prepareForRecording = async (page: Page): Promise<void> => {
  // Expose the logBot function to the browser context
  await page.exposeFunction('logBot', (msg: string) => {
    log(msg);
  });
};

const joinMeeting = async (page: Page, meetingUrl: string, botName: string) => {
  const enterNameField = 'input[type="text"][aria-label="Your name"]';
  const joinButton = '//button[.//span[text()="Ask to join"]]';
  const muteButton = '[aria-label*="Turn off microphone"]';
  const cameraOffButton = '[aria-label*="Turn off camera"]';

  await page.goto(meetingUrl, { waitUntil: "networkidle" });
  await page.bringToFront();

  // Add a longer, fixed wait after navigation for page elements to settle
  log("Waiting for page elements to settle after navigation...");
  await page.waitForTimeout(5000); // Wait 5 seconds

  // Enter name and join
  // Keep the random delay before interacting, but ensure page is settled first
  await page.waitForTimeout(randomDelay(1000)); 
  log("Attempting to find name input field...");
  // Increase timeout drastically
  await page.waitForSelector(enterNameField, { timeout: 120000 }); // 120 seconds
  log("Name input field found.");

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

// Modified to have only the actual recording functionality
const startRecording = async (page: Page, botConfig: BotConfig) => {
  // Destructure needed fields from botConfig
  const { meetingUrl, token, connectionId, platform, nativeMeetingId } = botConfig; // nativeMeetingId is now in BotConfig type

  log("Starting actual recording with WebSocket connection");

  // Pass the necessary config fields into the page context
  // Add type assertion for the object passed to evaluate
  await page.evaluate(async (config: BotConfig) => {
    // Destructure inside evaluate with types if needed, or just use config.* directly
    const { meetingUrl, token, connectionId, platform, nativeMeetingId } = config;

    const option = {
      language: null,
      task: "transcribe",
      modelSize: "medium",
      useVad: true,
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
        
        // NEW: Create audio context and destination for mixing multiple streams
        (window as any).logBot(`Found ${mediaElements.length} active media elements.`);
        const audioContext = new AudioContext();
        const destinationNode = audioContext.createMediaStreamDestination();
        let sourcesConnected = 0;

        // NEW: Connect all media elements to the destination node
        mediaElements.forEach((element: any, index: number) => {
          try {
            const elementStream = element.srcObject || (element.captureStream && element.captureStream()) || 
                                 (element.mozCaptureStream && element.mozCaptureStream());
            
            if (elementStream instanceof MediaStream && elementStream.getAudioTracks().length > 0) {
              const sourceNode = audioContext.createMediaStreamSource(elementStream);
              sourceNode.connect(destinationNode);
              sourcesConnected++;
              (window as any).logBot(`Connected audio stream from element ${index+1}/${mediaElements.length}.`);
            }
          } catch (error: any) {
            (window as any).logBot(`Could not connect element ${index+1}: ${error.message}`);
          }
        });

        if (sourcesConnected === 0) {
          return reject(new Error("[BOT Error] Could not connect any audio streams. Check media permissions."));
        }

        // Use the combined stream instead of a single element's stream
        const stream = destinationNode.stream;
        (window as any).logBot(`Successfully combined ${sourcesConnected} audio streams.`);

        // Ensure meetingUrl is not null before using btoa
        const uniquePart = connectionId || btoa(nativeMeetingId || meetingUrl || ''); // Added || '' fallback for null meetingUrl
        const structuredId = `${platform}_${uniquePart}`;

        const wsUrl = "ws://whisperlive:9090";
        (window as any).logBot(`Attempting to connect WebSocket to: ${wsUrl} with platform: ${platform}`);
        
        let socket: WebSocket | null = null;
        let isServerReady = false;
        let language = option.language;
        let retryCount = 0;
        const maxRetries = 5;
        const retryDelay = 2000;
        
        const setupWebSocket = () => {
          try {
            if (socket) {
              // Close previous socket if it exists
              try {
                socket.close();
              } catch (err) {
                // Ignore errors when closing
              }
            }
            
            socket = new WebSocket(wsUrl);
            
            socket.onopen = function() {
              (window as any).logBot("WebSocket connection opened.");
              retryCount = 0;

              if (socket) {
                // Construct the handshake message DIRECTLY here
                // Ensure platform, token, nativeMeetingId, meetingUrl are correctly passed
                // into the page.evaluate scope from the outer botConfig
                const handshakePayload = {
                    uid: structuredId,       // From earlier construction based on nativeMeetingId/connectionId
                    language: null,          // *** CHANGED from "ru" to null ***
                    task: "transcribe",     // Literal value - Ensure this is required
                    model: "medium",       // Literal value or from config if needed
                    use_vad: true,           // Literal value or from config if needed
                    platform: platform,      // External platform name passed into evaluate
                    token: token,            // User token passed into evaluate
                    meeting_id: nativeMeetingId, // Native ID passed into evaluate
                    meeting_url: meetingUrl  // Meeting URL passed into evaluate
                };

                const jsonPayload = JSON.stringify(handshakePayload);

                // Log the exact payload being sent
                (window as any).logBot(`DEBUG: Sending Handshake Payload: ${jsonPayload}`);
                socket.send(jsonPayload);
              }
            };

            socket.onmessage = (event) => {
              (window as any).logBot("Received message: " + event.data);
              const data = JSON.parse(event.data);
              if (data["uid"] !== structuredId) return;
              if (data["status"] === "ERROR") {
                 (window as any).logBot(`WebSocket Server Error: ${data["message"]}`);
              } else if (data["status"] === "WAIT") {
                 (window as any).logBot(`Server busy: ${data["message"]}`);
              } else if (!isServerReady) {
                 isServerReady = true;
                 (window as any).logBot("Server is ready.");
              } else if (language === null && data["language"]) {
                (window as any).logBot(`Language detected: ${data["language"]}`);
              } else if (data["message"] === "DISCONNECT") {
                (window as any).logBot("Server requested disconnect.");
                if (socket) {
                  socket.close();
                }
              } else {
                (window as any).logBot(`Transcription: ${JSON.stringify(data)}`);
              }
            };

            socket.onerror = (event) => {
              (window as any).logBot(`WebSocket error: ${JSON.stringify(event)}`);
            };

            socket.onclose = (event) => {
              (window as any).logBot(
                `WebSocket connection closed. Code: ${event.code}, Reason: ${event.reason}`
              );
              
              // Retry logic
              if (retryCount < maxRetries) {
                const exponentialDelay = retryDelay * Math.pow(2, retryCount);
                retryCount++;
                (window as any).logBot(`Attempting to reconnect in ${exponentialDelay}ms. Retry ${retryCount}/${maxRetries}`);
                
                setTimeout(() => {
                  (window as any).logBot(`Retrying WebSocket connection (${retryCount}/${maxRetries})...`);
                  setupWebSocket();
                }, exponentialDelay);
              } else {
                (window as any).logBot("Maximum WebSocket reconnection attempts reached. Giving up.");
                // Optionally, we could reject the promise here if required
              }
            };
          } catch (e: any) {
            (window as any).logBot(`Error creating WebSocket: ${e.message}`);
            // For initial connection errors, handle with retry logic
            if (retryCount < maxRetries) {
              const exponentialDelay = retryDelay * Math.pow(2, retryCount);
              retryCount++;
              (window as any).logBot(`Attempting to reconnect in ${exponentialDelay}ms. Retry ${retryCount}/${maxRetries}`);
              
              setTimeout(() => {
                (window as any).logBot(`Retrying WebSocket connection (${retryCount}/${maxRetries})...`);
                setupWebSocket();
              }, exponentialDelay);
            } else {
              return reject(new Error(`WebSocket creation failed after ${maxRetries} attempts: ${e.message}`));
            }
          }
        };
        
        setupWebSocket();

        // FIXED: Revert to original audio processing that works with whisperlive
        // but use our combined stream as the input source
        const audioDataCache = [];
        const context = new AudioContext();
        const mediaStream = context.createMediaStreamSource(stream); // Use our combined stream
        const recorder = context.createScriptProcessor(4096, 1, 1);

        recorder.onaudioprocess = async (event) => {
          // Check if server is ready AND socket is open
          if (!isServerReady || !socket || socket.readyState !== WebSocket.OPEN) {
               // (window as any).logBot("WS not ready or closed, skipping audio data send."); // Optional debug log
               return;
          }
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
          }
          // Send resampledData
           if (socket && socket.readyState === WebSocket.OPEN) { // Double check before sending
                socket.send(resampledData);
           }
        };

        // Connect the audio processing pipeline
        mediaStream.connect(recorder);
        recorder.connect(context.destination);
        
        (window as any).logBot("Audio processing pipeline connected and sending data.");

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
  }, botConfig);
};

// Remove the compatibility shim 'recordMeeting' if no longer needed,
// otherwise, ensure it constructs a valid BotConfig object.
// Example if keeping:
/*
const recordMeeting = async (page: Page, meetingUrl: string, token: string, connectionId: string, platform: "google_meet" | "zoom" | "teams") => {
  await prepareForRecording(page);
  // Construct a minimal BotConfig - adjust defaults as needed
  const dummyConfig: BotConfig = {
      platform: platform,
      meetingUrl: meetingUrl,
      botName: "CompatibilityBot",
      token: token,
      connectionId: connectionId,
      nativeMeetingId: "", // Might need to derive this if possible
      automaticLeave: { waitingRoomTimeout: 300000, noOneJoinedTimeout: 300000, everyoneLeftTimeout: 300000 },
  };
  await startRecording(page, dummyConfig);
};
*/
