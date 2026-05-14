import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LogsQueryDto } from './dto/logs-query.dto';
import { SpeakDto } from './dto/speak.dto';
import { TtsService } from './tts.service';

@Controller('tts')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class TtsController {
  constructor(private readonly ttsService: TtsService) {}

  /**
   * POST /tts/speak
   * Accepts a SpeakDto, fires the TTS pipeline asynchronously, and returns
   * HTTP 202 with the operationId immediately.
   */
  @Post('speak')
  // @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  async speak(@Body() dto: SpeakDto): Promise<{ operationId: string }> {
    return this.ttsService.speak(dto);
  }

  /**
   * GET /tts/logs
   * Returns recent TTS operation logs, ordered by createdAt desc.
   * Accepts an optional `limit` query param (1–500, default 100).
   */
  @Get('logs')
  @UseGuards(JwtAuthGuard)
  async getLogs(@Query() query: LogsQueryDto): Promise<object[]> {
    return this.ttsService.getLogs(query.limit ?? 100);
  }

  /**
   * GET /tts/health
   * No auth guard — intended for monitoring/uptime checks.
   * Returns connectivity status for OBS and the configured TTS provider.
   */
  @Get('health')
  async checkHealth() {
    return this.ttsService.checkHealth();
  }
}
