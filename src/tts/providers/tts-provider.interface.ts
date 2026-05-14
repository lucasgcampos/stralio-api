export interface ITtsProvider {
  synthesize(text: string, voiceId?: string): Promise<Buffer>;
  checkAvailability(): Promise<boolean>;
}
