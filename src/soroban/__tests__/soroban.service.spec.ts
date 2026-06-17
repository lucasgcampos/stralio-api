import { SorobanService } from '../soroban.service';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/shared/prisma/prisma.service';
import { EventProcessorService } from '../event-processor.service';

describe('SorobanService', () => {
  let service: SorobanService;
  let mockPrisma: {
    sorobanContract: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      delete: jest.Mock;
    };
    sorobanEvent: {
      findMany: jest.Mock;
    };
    eventIngestState: {
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    webhookSubscription: {
      create: jest.Mock;
    };
  };
  let mockEventProcessor: {
    processEvents: jest.Mock;
  };

  const mockContract = {
    id: 'contract-id',
    name: 'Test Contract',
    contractId: 'CBABC123DEF456',
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockPrisma = {
      sorobanContract: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      sorobanEvent: {
        findMany: jest.fn(),
      },
      eventIngestState: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      webhookSubscription: {
        create: jest.fn(),
      },
    };

    mockEventProcessor = {
      processEvents: jest.fn(),
    };

    const configService = new ConfigService({
      STELLAR_RPC_URL: 'https://soroban-testnet.stellar.org',
      SOROBAN_POLL_INTERVAL: '5000',
    });

    service = new SorobanService(
      configService,
      mockPrisma as unknown as PrismaService,
      mockEventProcessor as unknown as EventProcessorService,
    );
  });

  describe('registerContract', () => {
    it('should create a new contract', async () => {
      const dto = { name: 'Test Contract', contractId: 'CBABC123DEF456' };
      mockPrisma.sorobanContract.create.mockResolvedValue(mockContract);

      const result = await service.registerContract(dto);

      expect(mockPrisma.sorobanContract.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: dto.name,
          contractId: dto.contractId,
        }),
      });
      expect(result).toEqual(mockContract);
    });
  });

  describe('listContracts', () => {
    it('should return all contracts', async () => {
      mockPrisma.sorobanContract.findMany.mockResolvedValue([mockContract]);

      const result = await service.listContracts();

      expect(mockPrisma.sorobanContract.findMany).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });
  });

  describe('removeContract', () => {
    it('should delete a contract', async () => {
      mockPrisma.sorobanContract.delete.mockResolvedValue(mockContract);

      const result = await service.removeContract('contract-id');

      expect(mockPrisma.sorobanContract.delete).toHaveBeenCalledWith({
        where: { id: 'contract-id' },
      });
      expect(result).toEqual(mockContract);
    });
  });

  describe('addWebhook', () => {
    it('should create webhook for existing contract', async () => {
      const webhook = {
        id: 'webhook-id',
        contractId: 'CBABC123DEF456',
        url: 'https://example.com',
      };
      mockPrisma.sorobanContract.findUnique.mockResolvedValue(mockContract);
      mockPrisma.webhookSubscription.create.mockResolvedValue(webhook);

      const result = await service.addWebhook(
        'contract-id',
        'https://example.com',
      );

      expect(mockPrisma.webhookSubscription.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          contractId: mockContract.contractId,
          url: 'https://example.com',
        }),
      });
    });

    it('should throw error when contract not found', async () => {
      mockPrisma.sorobanContract.findUnique.mockResolvedValue(null);

      await expect(
        service.addWebhook('nonexistent', 'https://example.com'),
      ).rejects.toThrow('Contract not found');
    });
  });

  describe('listEvents', () => {
    it('should return events ordered by creation date', async () => {
      const events = [{ id: '1', createdAt: new Date() }];
      mockPrisma.sorobanEvent.findMany.mockResolvedValue(events as any);

      const result = await service.listEvents();

      expect(mockPrisma.sorobanEvent.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      expect(result).toEqual(events);
    });
  });

  describe('getIngestState', () => {
    it('should return ingest state', async () => {
      const state = { id: 'state-id', lastLedger: 12345, cursor: 'cursor-abc' };
      mockPrisma.eventIngestState.findFirst.mockResolvedValue(state as any);

      const result = await service.getIngestState();

      expect(mockPrisma.eventIngestState.findFirst).toHaveBeenCalled();
      expect(result).toEqual(state);
    });
  });
});
