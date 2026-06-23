import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { PrismaService } from 'src/shared/prisma/prisma.service';
import { HashService } from 'src/shared/hash.service';
import { JwtService } from '@nestjs/jwt';

describe('AuthService', () => {
  let authService: AuthService;
  let mockPrisma: { user: { findFirst: jest.Mock } };
  let mockHashService: { verify: jest.Mock };
  let mockJwtService: { sign: jest.Mock };

  const mockUser = {
    id: 'test-user-id',
    personId: 'person-123',
    email: 'test@example.com',
    name: 'Test User',
    password: 'hashedpassword',
  };

  beforeEach(() => {
    mockPrisma = {
      user: {
        findFirst: jest.fn(),
      },
    };

    mockHashService = {
      verify: jest.fn(),
    };

    mockJwtService = {
      sign: jest.fn().mockReturnValue('test-jwt-token'),
    };

    authService = new AuthService(
      mockPrisma as unknown as PrismaService,
      mockJwtService as unknown as JwtService,
      mockHashService as unknown as HashService,
    );
  });

  it('should be defined', () => {
    expect(authService).toBeDefined();
  });

  describe('login', () => {
    it('should return JWT token when credentials are valid', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockHashService.verify.mockResolvedValue(true);

      const result = await authService.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result).toMatchObject({ access_token: 'test-jwt-token' });
      expect(mockJwtService.sign).toHaveBeenCalledWith({
        sub: mockUser.personId,
      });
    });

    it('should throw UnauthorizedException when user not found', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(
        authService.login({
          email: 'nonexistent@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when password is wrong', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockHashService.verify.mockResolvedValue(false);

      await expect(
        authService.login({
          email: 'test@example.com',
          password: 'wrongpassword',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
