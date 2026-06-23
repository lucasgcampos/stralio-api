import { Injectable } from '@nestjs/common';
import { ulid } from 'ulid';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/shared/prisma/prisma.service';
import { HashService } from 'src/shared/hash.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: HashService,
  ) {}

  async create(user: Prisma.UserUncheckedCreateInput) {
    const password = await this.crypto.createHash(user.password);

    return this.prisma.user.create({
      data: {
        personId: ulid(),
        email: user.email,
        name: user.name,
        password: password,
        document: user.document,
        roleId: user.roleId,
      },
    });
  }

  findAll() {
    return this.prisma.user.findMany();
  }

  findOne(personId: string) {
    return this.prisma.user.findFirst({
      where: {
        personId: personId,
      },
    });
  }
}
