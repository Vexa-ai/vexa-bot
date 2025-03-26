export function log(message: string): void {
  console.log(`[BotCore] ${message}`);
}

export function randomDelay(amount: number) {
  return (2 * Math.random() - 1) * (amount / 10) + amount;
}

