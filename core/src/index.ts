import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { log } from "./utils";
import { chromium } from "playwright-extra";
import { handleGoogleMeet } from "./platforms/google";
import { browserArgs, userAgent } from "./constans";
import { BotConfig } from "./types";

export async function runBot(botConfig: BotConfig): Promise<void> {
  const { meetingUrl, platform, botName } = botConfig;

  log(`Starting bot for ${platform} with URL: ${meetingUrl} and name: ${botName}`);

  // Use Stealth Plugin to avoid detection
  const stealthPlugin = StealthPlugin();
  stealthPlugin.enabledEvasions.delete("iframe.contentWindow");
  stealthPlugin.enabledEvasions.delete("media.codecs");
  chromium.use(stealthPlugin);

  // Launch browser with stealth configuration
  const browser = await chromium.launch({
    headless: false, // Use headed mode for Google Meet as it tends to detect headless browsers
    args: [
      ...browserArgs,
      "--disable-blink-features=AutomationControlled"
    ]
  });

  // Create a new page with permissions and viewport
  const context = await browser.newContext({
    permissions: ["camera", "microphone"],
    userAgent,
    viewport: { width: 1280, height: 720 },
    screen: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false
  });
  
  // More advanced anti-detection
  await context.addInitScript(() => {
    // Override permissions
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters: any) => {
      return Promise.resolve({ state: "granted" } as PermissionStatus);
    };
    
    // Plugins and mime types
    Object.defineProperty(navigator, 'plugins', {
      get: () => {
        return [{
          0: {type: "application/pdf"},
          name: "PDF Viewer",
          description: "Portable Document Format",
          filename: "internal-pdf-viewer"
        }]
      },
    });
  });
  
  const page = await context.newPage();

  // Setup anti-detection measures
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    Object.defineProperty(navigator, "plugins", {
      get: () => [{ name: "Chrome PDF Plugin" }, { name: "Chrome PDF Viewer" }],
    });
    Object.defineProperty(navigator, "languages", {
      get: () => ["en-US", "en"],
    });
    Object.defineProperty(navigator, "hardwareConcurrency", { get: () => 4 });
    Object.defineProperty(navigator, "deviceMemory", { get: () => 8 });
    Object.defineProperty(window, "innerWidth", { get: () => 1920 });
    Object.defineProperty(window, "innerHeight", { get: () => 1080 });
    Object.defineProperty(window, "outerWidth", { get: () => 1920 });
    Object.defineProperty(window, "outerHeight", { get: () => 1080 });
  });

  switch (platform) {
    case 'google':
      await handleGoogleMeet(botConfig, page)
      break;
    case 'zoom':
      // todo
      //await handleMeet(page);
      break;
    case 'teams':
      // todo
      //  await handleTeams(page);
      break;
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
  await browser.close();
  log('Bot execution completed.');
}
