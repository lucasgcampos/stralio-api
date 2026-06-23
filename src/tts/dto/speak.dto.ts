import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export const MAX_TEXT_LENGTH = 500;
export const MAX_VOICE_ID_LENGTH = 100;
export const MAX_SCENE_LENGTH = 50;

export class SpeakDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_TEXT_LENGTH)
  text: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_VOICE_ID_LENGTH)
  voiceId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_SCENE_LENGTH)
  obsScene?: string;
}
