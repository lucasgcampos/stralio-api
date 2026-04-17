import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Server } from '@stellar/stellar-sdk/rpc';
import { PrismaService } from '../shared/prisma/prisma.service';
import { EventProcessorService } from './event-processor.service';
import { RegisterContractDto } from './dto/register-contract.dto';
import { ulid } from 'ulid';

@Injectable()
export class SorobanService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SorobanService.name);
  private server: Server;
  private pollInterval: number;
  private pollingTimer: NodeJS.Timeout;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly eventProcessor: EventProcessorService,
  ) {
    const rpcUrl = this.configService.get<string>('STELLAR_RPC_URL') || 'https://soroban-testnet.stellar.org';
    this.server = new Server(rpcUrl);
    this.pollInterval = parseInt(this.configService.get<string>('SOROBAN_POLL_INTERVAL') || '5000');
  }

  async onModuleInit() {
    this.startPolling();
  }

  onModuleDestroy() {
    if (this.pollingTimer) {
      clearTimeout(this.pollingTimer);
    }
  }

  async registerContract(dto: RegisterContractDto) {
    const id = ulid();
    return this.prisma.sorobanContract.create({
      data: {
        id,
        name: dto.name,
        contractId: dto.contractId,
      },
    });
  }

  listContracts() {
    return this.prisma.sorobanContract.findMany();
  }

  async removeContract(id: string) {
    return this.prisma.sorobanContract.delete({ where: { id } });
  }

  async addWebhook(contractId: string, url: string) {
    const contract = await this.prisma.sorobanContract.findUnique({ where: { id: contractId } });
    if (!contract) {
      throw new Error('Contract not found');
    }

    return this.prisma.webhookSubscription.create({
      data: {
        id: ulid(),
        contractId: contract.contractId,
        url,
      },
    });
  }

  listEvents() {
    return this.prisma.sorobanEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async getIngestState() {
    return this.prisma.eventIngestState.findFirst();
  }

  private startPolling() {
    this.poll();
  }

  private async poll() {
    try {
      await this.fetchAndProcessEvents();
    } catch (error) {
      this.logger.error(`Polling error: ${error.message}`);
    }

    this.pollingTimer = setTimeout(() => this.poll(), this.pollInterval);
  }

  private async fetchAndProcessEvents() {
    const contracts = await this.prisma.sorobanContract.findMany({
      where: { enabled: true },
    });

    if (contracts.length === 0) {  
      return;
    }

    const state = await this.prisma.eventIngestState.findFirst();
    let startLedger = state?.lastLedger || 0;

    const latestLedger = await this.server.getLatestLedger();

    if (startLedger === 0) {
      startLedger = latestLedger.sequence - 100;
    }

    for (const contract of contracts) {
      try {
        const response = await this.server.getEvents({
          startLedger,
          filters: [{
            type: 'contract',
            contractIds: [contract.contractId],
          }],
          limit: 100,
          // cursor: state?.cursor || undefined,
        });

        if (response.events.length > 0) {
          this.logger.debug(`Found ${response.events.length} events for ${contract.name}`);
          await this.eventProcessor.processEvents(contract.id, response.events);
        }

        if (response.cursor) {
          await this.updateIngestState(response.latestLedger, response.cursor);
        }
      } catch (error) {
        this.logger.error(`Failed to fetch events for ${contract.name}: ${error.message}`);
      }
    }
  }

  private async updateIngestState(lastLedger: number, cursor: string) {
    const existing = await this.prisma.eventIngestState.findFirst();

    if (existing) {
      await this.prisma.eventIngestState.update({
        where: { id: existing.id },
        data: { lastLedger, cursor },
      });
    } else {
      await this.prisma.eventIngestState.create({
        data: { id: ulid(), lastLedger, cursor },
      });
    }
  }
}
