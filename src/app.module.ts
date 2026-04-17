import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { SharedModule } from './shared/shared.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { SorobanModule } from './soroban/soroban.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), SharedModule, UsersModule, AuthModule, SorobanModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
