import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../shared/prisma/prisma.service';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(private readonly prisma: PrismaService) {}

  async deliverWebhooks(contractId: string, event: any) {
    const webhooks = await this.prisma.webhookSubscription.findMany({
      where: { contractId, enabled: true },
    });

    for (const webhook of webhooks) {
      await this.deliver(webhook.id, webhook.url, event);
    }
  }

  private async deliver(id: string, url: string, event: any) {
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(event),
        });

        if (response.ok) {
          await this.prisma.webhookSubscription.update({
            where: { id },
            data: { lastTriggered: new Date() },
          });
          this.logger.debug(`Webhook delivered to ${url}`);
          return;
        }

        throw new Error(`HTTP ${response.status}`);
      } catch {
        if (attempt === maxRetries) {
          this.logger.error(
            `Webhook failed after ${maxRetries} attempts: ${url}`,
          );
          return;
        }
        const delay = Math.pow(2, attempt - 1) * 1000;
        this.logger.warn(
          `Webhook attempt ${attempt} failed, retrying in ${delay}ms`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
}
