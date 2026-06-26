import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { SharedModule } from './shared/shared.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { SorobanModule } from './soroban/soroban.module';
import { TtsModule } from './tts/tts.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
        name: 'short',
      },
      {
        ttl: 600000,
        limit: 500,
        name: 'long',
      },
    ]),
    ConfigModule.forRoot({ isGlobal: true }),
    SharedModule,
    UsersModule,
    AuthModule,
    SorobanModule,
    TtsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
