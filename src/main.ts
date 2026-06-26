import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle('Stralio API')
    .setDescription('TTS-powered streaming donation platform on Stellar')
    .setVersion('1.0')
    .addTag('tts', 'Text-to-Speech endpoints')
    .addTag('soroban', 'Soroban blockchain integration')
    .addTag('auth', 'Authentication endpoints')
    .addTag('users', 'User management')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
