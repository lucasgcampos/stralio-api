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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LogsQueryDto } from './dto/logs-query.dto';
import { SpeakDto } from './dto/speak.dto';
import { TtsService } from './tts.service';

@ApiTags('tts')
@Controller('tts')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
@UseGuards(ThrottlerGuard)
export class TtsController {
  constructor(private readonly ttsService: TtsService) {}

  @Post('speak')
  @ApiOperation({
    summary: 'Synthesize text to speech',
    description:
      'Accepts text and returns a job ID. Audio processing happens asynchronously.',
  })
  @ApiResponse({
    status: 202,
    description: 'TTS job accepted',
    schema: {
      example: { operationId: '01HYX7K9V2QJZM3N5RDPF8E4T6W' },
    },
  })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  @Throttle({ short: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.ACCEPTED)
  async speak(@Body() dto: SpeakDto): Promise<{ operationId: string }> {
    return this.ttsService.speak(dto.text, dto.voiceId, dto.obsScene);
  }

  @Get('logs')
  @ApiOperation({
    summary: 'Get TTS operation logs',
    description: 'Returns recent TTS job logs, ordered by creation date.',
  })
  @ApiBearerAuth()
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of logs to return (1-500, default 100)',
  })
  @ApiResponse({ status: 200, description: 'Array of log entries' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  async getLogs(@Query() query: LogsQueryDto): Promise<object[]> {
    return this.ttsService.getLogs(query.limit ?? 100);
  }

  @Get('health')
  @ApiOperation({
    summary: 'Check TTS and OBS connectivity',
    description: 'Returns health status for monitoring purposes.',
  })
  @ApiResponse({
    status: 200,
    description: 'Health status object',
  })
  async checkHealth() {
    return this.ttsService.checkHealth();
  }
}
