import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { ITtsProvider } from './tts-provider.interface';
import { TtsException } from '../exceptions/tts.exception';

const DEFAULT_VOICE =
  'Microsoft Server Speech Text to Speech Voice (pt-BR, FranciscaNeural)';

@Injectable()
export class EdgeTtsProvider implements ITtsProvider {
  constructor(private readonly config: ConfigService) {}

  async synthesize(text: string, voiceId?: string): Promise<Buffer> {
    const voice =
      voiceId ?? this.config.get<string>('TTS_DEFAULT_VOICE_ID') ?? DEFAULT_VOICE;

    const tts = new MsEdgeTTS();

    try {
      await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
    } catch (err) {
      throw new TtsException(
        'TTS_PROVIDER_UNAVAILABLE',
        `Edge TTS connection failed while setting metadata: ${(err as Error).message}`,
        err,
      );
    }

    return new Promise<Buffer>((resolve, reject) => {
      let stream: ReturnType<MsEdgeTTS['toStream']>['audioStream'];

      try {
        const { audioStream } = tts.toStream(text);
        stream = audioStream;
      } catch (err) {
        reject(
          new TtsException(
            'TTS_PROVIDER_UNAVAILABLE',
            `Edge TTS failed to create audio stream: ${(err as Error).message}`,
            err,
          ),
        );
        return;
      }

      const chunks: Buffer[] = [];

      stream.on('data', (chunk: Buffer) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });

      stream.on('end', () => {
        resolve(Buffer.concat(chunks));
      });

      stream.on('error', (err: Error) => {
        reject(
          new TtsException(
            'TTS_PROVIDER_UNAVAILABLE',
            `Edge TTS audio stream error: ${err.message}`,
            err,
          ),
        );
      });
    });
  }

  async checkAvailability(): Promise<boolean> {
    try {
      const tts = new MsEdgeTTS();
      await tts.getVoices();
      return true;
    } catch {
      return false;
    }
  }
}
