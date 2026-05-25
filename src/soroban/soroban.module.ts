import { Module } from '@nestjs/common';
import { SorobanController } from './soroban.controller';
import { SorobanService } from './soroban.service';
import { EventProcessorService } from './event-processor.service';
import { WebhookService } from './webhook.service';
import { SharedModule } from '../shared/shared.module';
import { TtsModule } from '../tts/tts.module';

@Module({
  imports: [SharedModule, TtsModule],
  controllers: [SorobanController],
  providers: [SorobanService, EventProcessorService, WebhookService],
  exports: [SorobanService],
})
export class SorobanModule { }
