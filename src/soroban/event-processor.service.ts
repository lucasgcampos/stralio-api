import { Injectable, Logger } from '@nestjs/common';
import { scValToNative } from '@stellar/stellar-sdk';
import { TtsService } from 'src/tts/tts.service';
import { ulid } from 'ulid';
import { PrismaService } from '../shared/prisma/prisma.service';
import { WebhookService } from './webhook.service';

interface SorobanEventData {
  id: string;
  value: unknown;
  topic: unknown[];
  ledger: number;
  ledgerClosedAt: string;
}

interface TransferBody {
  username: string;
  message: string;
  amount: bigint;
}

@Injectable()
export class EventProcessorService {
  private readonly logger = new Logger(EventProcessorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ttsService: TtsService,
    private readonly webhookService: WebhookService,
  ) {}

  async processEvents(contractId: string, events: SorobanEventData[]) {
    for (const event of events) {
      try {
        await this.processEvent(contractId, event);
      } catch (error) {
        this.logger.error(
          `Failed to process event ${event.id}: ${(error as Error).message}`,
        );
      }
    }
  }

  private async processEvent(contractId: string, event: SorobanEventData) {
    const existing = await this.prisma.sorobanEvent.findUnique({
      where: { eventId: event.id },
    });

    if (existing) {
      this.logger.debug(`Skipping duplicate event: ${event.id}`);
      return;
    }

    // @ts-expect-error - stellar-sdk scValToNative expects ScVal but we receive raw event data
    const body = scValToNative(event.value) as TransferBody;
    // @ts-expect-error - stellar-sdk scValToNative expects ScVal but we receive raw event data
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    const topics = event.topic.map((topic) => scValToNative(topic));
    const amount = BigInt(body.amount) / BigInt(10000000);

    await this.ttsService.speak(
      `${body.username} enviou ${amount} XML: ${body.message}`,
      undefined,
      'Scene',
    );

    const created = await this.prisma.sorobanEvent.create({
      data: {
        id: ulid(),
        eventId: event.id,
        contractId,
        topic: (topics[0] as string) || 'unknown',
        eventType: (topics[0] as string) || 'unknown',
        ledger: event.ledger,
        timestamp: new Date(event.ledgerClosedAt),
        data: { a: 1 },
      },
    });

    this.logger.debug(`Stored event: ${event.id} (ledger: ${event.ledger})`);

    await this.webhookService.deliverWebhooks(contractId, {
      eventId: event.id,
      contractId,
      eventType: created.eventType,
      ledger: event.ledger,
      data: { a: 1 },
    });
  }
}
