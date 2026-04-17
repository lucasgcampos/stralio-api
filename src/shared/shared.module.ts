import { Module } from '@nestjs/common';
import { HashService } from './hash.service';
import { PrismaService } from './prisma/prisma.service';

@Module({
  providers: [PrismaService, HashService],
  exports: [PrismaService, HashService],
})
export class SharedModule {}