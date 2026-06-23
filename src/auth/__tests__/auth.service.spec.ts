import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';

describe('AuthService', () => {
  let authService: any;
  let mockPrisma: any;
  let mockHashService: any;
  let mockJwtService: any;

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

    // Create a simple test instance without full NestJS DI
    authService = new AuthService(mockPrisma, mockJwtService, mockHashService);
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

      expect(result).toHaveProperty('access_token', 'test-jwt-token');
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
