import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class SpeakDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  text: string;

  @IsOptional()
  @IsString()
  voiceId?: string;

  @IsOptional()
  @IsString()
  obsScene?: string;
}
