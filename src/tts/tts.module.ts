import { Module } from '@nestjs/common';
import { SharedModule } from '../shared/shared.module';
import { TtsController } from './tts.controller';
import { TtsService } from './tts.service';
import { ObsService } from './obs.service';
import { TtsProviderFactory } from './providers/tts-provider.factory';
// import { ElevenLabsProvider } from './providers/elevenlabs.provider';
// import { OpenAiProvider } from './providers/openai.provider';
import { EdgeTtsProvider } from './providers/edge-tts.provider';

@Module({
  imports: [SharedModule],
  controllers: [TtsController],
  providers: [
    TtsService,
    ObsService,
    TtsProviderFactory,
    // ElevenLabsProvider,
    // OpenAiProvider,
    EdgeTtsProvider,
  ],
  exports: [TtsService]
})
export class TtsModule {}
