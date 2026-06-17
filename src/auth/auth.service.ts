import { Injectable, UnauthorizedException } from '@nestjs/common';
import { HashService } from 'src/shared/hash.service';
import { PrismaService } from 'src/shared/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly hashService: HashService,
  ) {}

  async login(login: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        email: login.email,
      },
    });

    if (user != null) {
      const isMatch = await this.hashService.verify(
        login.password,
        user.password,
      );

      if (isMatch) {
        const payload = { sub: user.personId };
        return {
          access_token: this.jwtService.sign(payload),
        };
      }
    }

    throw new UnauthorizedException('user unauthorized');
  }
}
