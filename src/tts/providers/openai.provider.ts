import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI, {
  APIConnectionError,
  APIConnectionTimeoutError,
  AuthenticationError,
  PermissionDeniedError,
  RateLimitError,
} from 'openai';
import { ITtsProvider } from './tts-provider.interface';
import { TtsException } from '../exceptions/tts.exception';

@Injectable()
export class OpenAiProvider implements ITtsProvider {
  private readonly client: OpenAI;

  constructor(private readonly config: ConfigService) {
    this.client = new OpenAI({
      apiKey: this.config.get<string>('TTS_PROVIDER_API_KEY'),
    });
  }

  async synthesize(text: string, voiceId?: string): Promise<Buffer> {
    const voice = (voiceId ??
      this.config.get<string>('TTS_DEFAULT_VOICE_ID') ??
      'alloy') as OpenAI.Audio.Speech.SpeechCreateParams['voice'];
    const model = this.config.get<string>('TTS_OPENAI_MODEL') ?? 'tts-1';

    let response: Response;

    try {
      response = await this.client.audio.speech.create({
        model,
        voice,
        input: text,
        response_format: 'mp3',
      });
    } catch (err) {
      throw this.mapError(err);
    }

    try {
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (err) {
      throw this.mapError(err);
    }
  }

  async checkAvailability(): Promise<boolean> {
    try {
      await this.client.models.list();
      return true;
    } catch {
      return false;
    }
  }

  private mapError(err: unknown): TtsException {
    if (err instanceof APIConnectionTimeoutError) {
      return new TtsException(
        'TTS_PROVIDER_UNAVAILABLE',
        `OpenAI request timed out: ${err.message}`,
        err,
      );
    }

    if (err instanceof APIConnectionError) {
      return new TtsException(
        'TTS_PROVIDER_UNAVAILABLE',
        `OpenAI connection error: ${err.message}`,
        err,
      );
    }

    if (
      err instanceof AuthenticationError ||
      err instanceof PermissionDeniedError
    ) {
      return new TtsException(
        'TTS_PROVIDER_AUTH_ERROR',
        `OpenAI authentication failed (HTTP ${(err as AuthenticationError).status}): ${err.message}`,
        err,
      );
    }

    if (err instanceof RateLimitError) {
      return new TtsException(
        'TTS_PROVIDER_QUOTA_EXCEEDED',
        `OpenAI quota exceeded (HTTP 429): ${err.message}`,
        err,
      );
    }

    // Network errors, ECONNREFUSED, ENOTFOUND, ETIMEDOUT, etc.
    const isNetworkError =
      err instanceof Error &&
      (err.message.includes('ECONNREFUSED') ||
        err.message.includes('ENOTFOUND') ||
        err.message.includes('ETIMEDOUT') ||
        err.message.includes('network') ||
        err.message.includes('fetch'));

    if (isNetworkError) {
      return new TtsException(
        'TTS_PROVIDER_UNAVAILABLE',
        `OpenAI network error: ${err.message}`,
        err,
      );
    }

    return new TtsException(
      'TTS_PROVIDER_UNAVAILABLE',
      `OpenAI unexpected error: ${err instanceof Error ? err.message : String(err)}`,
      err,
    );
  }
}
