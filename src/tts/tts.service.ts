import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { ulid } from 'ulid';
import { PrismaService } from '../shared/prisma/prisma.service';
import { ObsService } from './obs.service';
import { TtsProviderFactory } from './providers/tts-provider.factory';
import { HealthResponseDto } from './dto/health-response.dto';
import { TtsException } from './exceptions/tts.exception';

@Injectable()
export class TtsService implements OnModuleInit {
  private readonly logger = new Logger(TtsService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly providerFactory: TtsProviderFactory,
    private readonly obsService: ObsService,
  ) {}

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  onModuleInit(): void {
    const alwaysRequired = [
      'TTS_PROVIDER',
      'OBS_WS_HOST',
      'OBS_WS_PORT',
      'OBS_MEDIA_SOURCE_NAME',
    ];

    for (const key of alwaysRequired) {
      if (!this.config.get<string>(key)) {
        throw new Error(
          `Missing required environment variable: ${key}. Please set it before starting the application.`,
        );
      }
    }

    const provider = this.config.get<string>('TTS_PROVIDER');
    if (provider === 'elevenlabs' || provider === 'openai') {
      if (!this.config.get<string>('TTS_PROVIDER_API_KEY')) {
        throw new Error(
          `Missing required environment variable: TTS_PROVIDER_API_KEY. ` +
            `This variable is required when TTS_PROVIDER is "${provider}".`,
        );
      }
    }

    const outputDir = this.getOutputDir();
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      this.logger.log(`Created TTS audio output directory: ${outputDir}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  async speak(
    text: string,
    voiceId?: string,
    obsScene?: string,
  ): Promise<{ operationId: string }> {
    const operationId = ulid();

    // Fire-and-forget: do not await the pipeline
    this.runPipeline(operationId, text, voiceId, obsScene).catch((err) => {
      // runPipeline handles its own error logging and DB persistence;
      // this catch is a safety net for unexpected throws outside the try/catch.
      this.logger.error(
        `Unexpected error in runPipeline for operationId=${operationId}: ${(err as Error).message}`,
        (err as Error).stack,
      );
    });

    return Promise.resolve({ operationId });
  }

  async getLogs(limit: number): Promise<object[]> {
    return this.prisma.ttsLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async checkHealth(): Promise<HealthResponseDto> {
    const [obsOk, ttsOk] = await Promise.all([
      this.obsService.checkConnectivity(),
      this.providerFactory.create().checkAvailability(),
    ]);

    return {
      obs: obsOk ? 'connected' : 'disconnected',
      ttsProvider: ttsOk ? 'available' : 'unavailable',
    };
  }

  // ---------------------------------------------------------------------------
  // Private pipeline
  // ---------------------------------------------------------------------------

  private async runPipeline(
    operationId: string,
    text: string,
    voiceIdParam?: string,
    obsScene?: string,
  ): Promise<void> {
    const outputDir = this.getOutputDir();
    const fileName = `${operationId}.mp3`;
    const filePath = path.join(outputDir, fileName);

    let errorCode: string | undefined;

    try {
      // 1. Synthesize audio
      const voiceId =
        voiceIdParam ?? this.config.get<string>('TTS_DEFAULT_VOICE_ID');

      let audioBuffer: Buffer;
      try {
        audioBuffer = await this.providerFactory
          .create()
          .synthesize(text, voiceId);
      } catch (err) {
        const code =
          err instanceof TtsException ? err.code : 'TTS_PROVIDER_UNAVAILABLE';
        throw new TtsException(
          code,
          `TTS synthesis failed: ${(err as Error).message}`,
          err,
        );
      }

      // 2. Write MP3 to disk
      try {
        fs.writeFileSync(filePath, audioBuffer);
      } catch (err) {
        throw new TtsException(
          'AUDIO_FILE_WRITE_ERROR',
          `Failed to write audio file to ${filePath}: ${(err as Error).message}`,
          err,
        );
      }

      // 3. Trigger OBS playback
      await this.obsService.playAudio(filePath, obsScene);

      // 4. Delete the audio file (best-effort, after OBS trigger is sent)
      this.deleteFile(filePath);

      // 5. Persist SUCCESS log
      // await this.prisma.ttsLog.create({
      //   data: {
      //     id: ulid(),
      //     operationId,
      //     text: dto.text,
      //     provider,
      //     filePath,
      //     status: 'SUCCESS',
      //   },
      // });
    } catch (err) {
      errorCode = err instanceof TtsException ? err.code : 'UNKNOWN_ERROR';

      this.logger.error(
        `Pipeline failed for operationId=${operationId} [${errorCode}]: ${(err as Error).message}`,
        (err as Error).stack,
      );

      // Best-effort file cleanup on failure
      this.deleteFile(filePath);

      // Persist FAILED log
      try {
        // await this.prisma.ttsLog.create({
        //   data: {
        //     id: ulid(),
        //     operationId,
        //     text: dto.text,
        //     provider,
        //     filePath,
        //     status: 'FAILED',
        //     errorCode,
        //   },
        // });
      } catch (dbErr) {
        this.logger.error(
          `Failed to persist FAILED TtsLog for operationId=${operationId}: ${(dbErr as Error).message}`,
        );
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private getOutputDir(): string {
    return this.config.get<string>('TTS_AUDIO_OUTPUT_DIR') ?? '/tmp/tts';
  }

  private deleteFile(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (err) {
      this.logger.warn(
        `Failed to delete audio file ${filePath}: ${(err as Error).message}`,
      );
    }
  }
}
