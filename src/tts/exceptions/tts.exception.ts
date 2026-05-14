// src/tts/exceptions/tts.exception.ts
export class TtsException extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'TtsException';
  }
}
