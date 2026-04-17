import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../shared/prisma/prisma.service';
import { WebhookService } from './webhook.service';
import { ulid } from 'ulid';
import { StrKey } from "@stellar/stellar-sdk";

@Injectable()
export class EventProcessorService {
  private readonly logger = new Logger(EventProcessorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly webhookService: WebhookService,
  ) {}

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

    const serializedData = this.serializeEvent(event);

    const created = await this.prisma.sorobanEvent.create({
      data: {
        id: ulid(),
        eventId: event.id,
        contractId,
        topic: serializedData.topic[0] || '',
        eventType: this.decodeEventType(serializedData.topic),
        ledger: event.ledger,
        timestamp: new Date(event.ledgerClosedAt),
        data: serializedData,
      },
    });

    this.logger.debug(`Stored event: ${event.id} (ledger: ${event.ledger})`);

    await this.webhookService.deliverWebhooks(contractId, {
      eventId: event.id,
      contractId,
      eventType: created.eventType,
      ledger: event.ledger,
      data: serializedData,
    });
  }

  private toAddress(address: string): string {
    try {
      return StrKey.encodeEd25519PublicKey(
        Buffer.from(address, "hex")
      );
    } catch {
      return 'unknow'
    }
  }

  private serializeEvent(event: any): any {
    if (event === null || event === undefined) {
      return event;
    }

    // Handle Buffer - convert to hex string
    if (Buffer.isBuffer(event)) {
      return event.toString('hex');
    }

    // Handle BigInt - convert to string
    if (typeof event === 'bigint') {
      return event.toString();
    }

    if (Array.isArray(event)) {
      return event.map(item => this.serializeEvent(item));
    }

    if (typeof event === 'object') {
      const result: any = {};
      for (const [key, value] of Object.entries(event)) {
        // Skip functions, symbols, and internal properties
        if (typeof value === 'function' || key.startsWith('_')) {
          continue;
        }
        result[key] = this.serializeEvent(value);
      }
      // Check if this is an XDR object with _value - extract the raw value
      if (event._value !== undefined && Object.keys(result).length === 0) {
        return this.serializeEvent(event._value);
      }
      return result;
    }

    // Primitives: return as-is
    return event;
  }

  private decodeEventType(topics: string[]): string {
    if (topics.length === 0) return 'unknown';

    try {
      const decoded = Buffer.from(topics[0], 'hex').toString('utf-8');
      return decoded || 'unknown';
    } catch {
      return 'unknown';
    }
  }
}
