import { UsersService } from '../users.service';
import { PrismaService } from 'src/shared/prisma/prisma.service';
import { HashService } from 'src/shared/hash.service';
import { User, Prisma } from '@prisma/client';

describe('UsersService', () => {
  let service: UsersService;
  let mockPrisma: {
    user: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };
  let mockHashService: {
    createHash: jest.Mock;
    verify: jest.Mock;
  };

  const mockUser = {
    id: 'test-user-id',
    personId: 'person-123',
    email: 'test@example.com',
    name: 'Test User',
    password: 'hashedpassword',
    document: '12345678900',
    roleId: 'role-id',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockPrisma = {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    mockHashService = {
      createHash: jest.fn(),
      verify: jest.fn(),
    };

    service = new UsersService(
      mockPrisma as unknown as PrismaService,
      mockHashService as unknown as HashService,
    );
  });

  describe('create', () => {
    it('should create a user with hashed password', async () => {
      const createInput: Prisma.UserUncheckedCreateInput = {
        email: 'test@example.com',
        password: 'rawpassword',
        name: 'Test User',
        document: '12345678900',
        roleId: 'role-id',
        personId: 'person-123',
      };

      mockHashService.createHash.mockResolvedValue('hashedpassword');
      mockPrisma.user.create.mockResolvedValue(mockUser as User);

      const result = await service.create(createInput);

      expect(mockHashService.createHash).toHaveBeenCalledWith('rawpassword');
      expect(mockPrisma.user.create).toHaveBeenCalled();
      expect(result).toEqual(mockUser);
    });
  });

  describe('findAll', () => {
    it('should return all users', async () => {
      mockPrisma.user.findMany.mockResolvedValue([mockUser]);

      const result = await service.findAll();

      expect(mockPrisma.user.findMany).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockUser);
    });

    it('should return empty array when no users exist', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toHaveLength(0);
    });
  });

  describe('findOne', () => {
    it('should return user by personId', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser as any);

      const result = await service.findOne('person-123');

      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: { personId: 'person-123' },
      });
      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      const result = await service.findOne('nonexistent');

      expect(result).toBeNull();
    });
  });
});
