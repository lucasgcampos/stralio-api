import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ITtsProvider } from './tts-provider.interface';
import { ElevenLabsProvider } from './elevenlabs.provider';
import { OpenAiProvider } from './openai.provider';
import { EdgeTtsProvider } from './edge-tts.provider';

@Injectable()
export class TtsProviderFactory {
  constructor(private readonly config: ConfigService) {}

  create(): ITtsProvider {
    const provider = this.config.get<string>('TTS_PROVIDER');
    switch (provider) {
      // case 'elevenlabs':
        // return new ElevenLabsProvider(this.config);
      case 'openai':
        return new OpenAiProvider(this.config);
      case 'edge-tts':
        return new EdgeTtsProvider(this.config);
      default:
        throw new Error(
          `Unknown TTS_PROVIDER: "${provider}". Must be "elevenlabs", "openai", or "edge-tts".`,
        );
    }
  }
}
