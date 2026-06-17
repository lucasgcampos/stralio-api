import { Test, TestingModule } from '@nestjs/testing';
import { TtsProviderFactory } from '../providers/tts-provider.factory';
import { OpenAiProvider } from '../providers/openai.provider';
import { EdgeTtsProvider } from '../providers/edge-tts.provider';
import { ConfigService } from '@nestjs/config';

describe('TtsProviderFactory', () => {
  let factory: TtsProviderFactory;
  let configService: ConfigService;

  beforeEach(async () => {
    configService = new ConfigService({
      TTS_PROVIDER: 'edge-tts',
      TTS_PROVIDER_API_KEY: 'test-api-key',
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TtsProviderFactory,
        OpenAiProvider,
        EdgeTtsProvider,
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    factory = module.get<TtsProviderFactory>(TtsProviderFactory);
  });

  it('should be defined', () => {
    expect(factory).toBeDefined();
  });

  describe('create', () => {
    it('should return Edge-TTS provider when configured', () => {
      const provider = factory.create();
      expect(provider).toBeInstanceOf(EdgeTtsProvider);
    });

    it('should return OpenAI provider when configured', () => {
      const openAiConfig = new ConfigService({
        TTS_PROVIDER: 'openai',
        TTS_PROVIDER_API_KEY: 'key',
      });
      const openAiFactory = new TtsProviderFactory(openAiConfig);
      const provider = openAiFactory.create();
      expect(provider).toBeInstanceOf(OpenAiProvider);
    });
  });

  describe('create', () => {
    it('should throw error for unknown provider', () => {
      const unknownConfig = new ConfigService({ TTS_PROVIDER: 'unknown' });
      const unknownFactory = new TtsProviderFactory(unknownConfig);

      expect(() => unknownFactory.create()).toThrow('Unknown TTS_PROVIDER');
    });

    it('should throw error when no provider configured', () => {
      const emptyConfig = new ConfigService({});
      const emptyFactory = new TtsProviderFactory(emptyConfig);

      expect(() => emptyFactory.create()).toThrow('Unknown TTS_PROVIDER');
    });
  });
});
