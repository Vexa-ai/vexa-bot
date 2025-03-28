export type BotConfig = {
  platform: "google" | "zoom" | "teams",
  meetingUrl: string,
  botName: string,
  token:string,
  connectionId: string,
  automaticLeave: {
    waitingRoomTimeout: number,
    noOneJoinedTimeout: number,
    everyoneLeftTimeout: number
  }
}
