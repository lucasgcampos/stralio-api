import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const MAX_TEXT_LENGTH = 500;
export const MAX_VOICE_ID_LENGTH = 100;
export const MAX_SCENE_LENGTH = 50;

export class SpeakDto {
  @ApiProperty({
    description: 'Text to be synthesized to speech',
    maxLength: MAX_TEXT_LENGTH,
    example: 'Hello viewers, thank you for your donation!',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_TEXT_LENGTH)
  text: string;

  @ApiPropertyOptional({
    description: 'TTS provider voice ID',
    maxLength: MAX_VOICE_ID_LENGTH,
    example: 'alloy',
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_VOICE_ID_LENGTH)
  voiceId?: string;

  @ApiPropertyOptional({
    description: 'OBS scene name to play audio in',
    maxLength: MAX_SCENE_LENGTH,
    example: 'Main Scene',
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_SCENE_LENGTH)
  obsScene?: string;
}
