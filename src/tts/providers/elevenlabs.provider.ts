import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ElevenLabsClient, ElevenLabsError, ElevenLabsTimeoutError } from 'elevenlabs';
import { ITtsProvider } from './tts-provider.interface';
import { TtsException } from '../exceptions/tts.exception';

@Injectable()
export class ElevenLabsProvider implements ITtsProvider {
  private readonly client: ElevenLabsClient;

  constructor(private readonly config: ConfigService) {
    this.client = new ElevenLabsClient({
      apiKey: this.config.get<string>('TTS_PROVIDER_API_KEY'),
    });
  }

  async synthesize(text: string, voiceId?: string): Promise<Buffer> {
    const voice =
      voiceId ?? this.config.get<string>('TTS_DEFAULT_VOICE_ID') ?? '21m00Tcm4TlvDq8ikWAM';
    const modelId =
      this.config.get<string>('TTS_ELEVENLABS_MODEL_ID') ?? 'eleven_multilingual_v2';

    let audioStream: NodeJS.ReadableStream;

    try {
      audioStream = await this.client.textToSpeech.convert(voice, {
        text,
        model_id: modelId,
        output_format: 'mp3_44100_128',
      });
    } catch (err) {
      throw this.mapError(err);
    }

    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];

      audioStream.on('data', (chunk: Buffer) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });

      audioStream.on('end', () => {
        resolve(Buffer.concat(chunks));
      });

      audioStream.on('error', (err: Error) => {
        reject(this.mapError(err));
      });
    });
  }

  async checkAvailability(): Promise<boolean> {
    try {
      await this.client.models.getAll();
      return true;
    } catch {
      return false;
    }
  }

  private mapError(err: unknown): TtsException {
    if (err instanceof ElevenLabsTimeoutError) {
      return new TtsException(
        'TTS_PROVIDER_UNAVAILABLE',
        `ElevenLabs request timed out: ${err.message}`,
        err,
      );
    }

    if (err instanceof ElevenLabsError) {
      if (err.statusCode === 401 || err.statusCode === 403) {
        return new TtsException(
          'TTS_PROVIDER_AUTH_ERROR',
          `ElevenLabs authentication failed (HTTP ${err.statusCode}): ${err.message}`,
          err,
        );
      }

      if (err.statusCode === 429) {
        return new TtsException(
          'TTS_PROVIDER_QUOTA_EXCEEDED',
          `ElevenLabs quota exceeded (HTTP 429): ${err.message}`,
          err,
        );
      }
    }

    // Network errors, ECONNREFUSED, ENOTFOUND, etc.
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
        `ElevenLabs network error: ${(err as Error).message}`,
        err,
      );
    }

    return new TtsException(
      'TTS_PROVIDER_UNAVAILABLE',
      `ElevenLabs unexpected error: ${err instanceof Error ? err.message : String(err)}`,
      err,
    );
  }
}
