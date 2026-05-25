import { Injectable, Logger } from '@nestjs/common';
import { scValToNative } from "@stellar/stellar-sdk";
import { TtsService } from 'src/tts/tts.service';
import { ulid } from 'ulid';
import { PrismaService } from '../shared/prisma/prisma.service';
import { WebhookService } from './webhook.service';

@Injectable()
export class EventProcessorService {
  private readonly logger = new Logger(EventProcessorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ttsService: TtsService,
    private readonly webhookService: WebhookService,
  ) { }

  async processEvents(contractId: string, events: any[]) {
    for (const event of events) {
      try {
        await this.processEvent(contractId, event);
      } catch (error) {
        this.logger.error(`Failed to process event ${event.id}: ${error.message}`);
      }
    }
  }

  private async processEvent(contractId: string, event: any) {
    const existing = await this.prisma.sorobanEvent.findUnique({
      where: { eventId: event.id },
    });

    if (existing) {
      this.logger.debug(`Skipping duplicate event: ${event.id}`);
      return;
    }

    const body = scValToNative(event.value);
    const topics = event.topic.map(topic => scValToNative(topic));
    //TODO: temporary
    const message = 'Ola mundo, seja bem vindo!'; 

    const amount = BigInt(body) / BigInt(10000000) ;
    
    await this.ttsService.speak(
      `Marco Aurélio enviou ${amount} XML: ${message}`,
      undefined,
      'Scene'
    );

    const created = await this.prisma.sorobanEvent.create({
      data: {
        id: ulid(),
        eventId: event.id,
        contractId,
        topic: topics[0] || 'unknown',
        eventType: topics[0] || 'unknown',
        ledger: event.ledger,
        timestamp: new Date(event.ledgerClosedAt),
        data: "{'a': 1}",
      },
    });

    this.logger.debug(`Stored event: ${event.id} (ledger: ${event.ledger})`);

    await this.webhookService.deliverWebhooks(contractId, {
      eventId: event.id,
      contractId,
      eventType: created.eventType,
      ledger: event.ledger,
      data: "{'a': 1}",
    });
  }
}
