import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  SpeakDto,
  MAX_TEXT_LENGTH,
  MAX_VOICE_ID_LENGTH,
  MAX_SCENE_LENGTH,
} from './speak.dto';

describe('SpeakDto', () => {
  describe('validation constants', () => {
    it('should have correct MAX_TEXT_LENGTH', () => {
      expect(MAX_TEXT_LENGTH).toBe(500);
    });

    it('should have correct MAX_VOICE_ID_LENGTH', () => {
      expect(MAX_VOICE_ID_LENGTH).toBe(100);
    });

    it('should have correct MAX_SCENE_LENGTH', () => {
      expect(MAX_SCENE_LENGTH).toBe(50);
    });
  });

  describe('text validation', () => {
    it('should accept valid text', async () => {
      const dto = plainToInstance(SpeakDto, { text: 'Hello world' });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should reject empty text', async () => {
      const dto = plainToInstance(SpeakDto, { text: '' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('text');
    });

    it('should reject text exceeding MAX_TEXT_LENGTH', async () => {
      const longText = 'a'.repeat(MAX_TEXT_LENGTH + 1);
      const dto = plainToInstance(SpeakDto, { text: longText });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('text');
    });

    it('should accept text at exactly MAX_TEXT_LENGTH', async () => {
      const exactText = 'a'.repeat(MAX_TEXT_LENGTH);
      const dto = plainToInstance(SpeakDto, { text: exactText });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should reject non-string text', async () => {
      const dto = plainToInstance(SpeakDto, { text: 123 } as any);
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('voiceId validation', () => {
    it('should accept valid voiceId', async () => {
      const dto = plainToInstance(SpeakDto, {
        text: 'Hello',
        voiceId: 'voice-123',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept missing voiceId (optional)', async () => {
      const dto = plainToInstance(SpeakDto, { text: 'Hello' });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should reject voiceId exceeding MAX_VOICE_ID_LENGTH', async () => {
      const longVoiceId = 'v'.repeat(MAX_VOICE_ID_LENGTH + 1);
      const dto = plainToInstance(SpeakDto, {
        text: 'Hello',
        voiceId: longVoiceId,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('voiceId');
    });
  });

  describe('obsScene validation', () => {
    it('should accept valid scene', async () => {
      const dto = plainToInstance(SpeakDto, {
        text: 'Hello',
        obsScene: 'Main Scene',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should accept missing obsScene (optional)', async () => {
      const dto = plainToInstance(SpeakDto, { text: 'Hello' });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should reject scene exceeding MAX_SCENE_LENGTH', async () => {
      const longScene = 's'.repeat(MAX_SCENE_LENGTH + 1);
      const dto = plainToInstance(SpeakDto, {
        text: 'Hello',
        obsScene: longScene,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('obsScene');
    });
  });

  describe('complete valid DTO', () => {
    it('should accept valid complete DTO', async () => {
      const dto = plainToInstance(SpeakDto, {
        text: 'Thank you for the donation!',
        voiceId: 'pt-BR-FranciscaNeural',
        obsScene: 'Live',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });
});
