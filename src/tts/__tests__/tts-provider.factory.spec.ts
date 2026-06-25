import { Test, TestingModule } from '@nestjs/testing';
import { TtsProviderFactory } from '../providers/tts-provider.factory';
import { ConfigService } from '@nestjs/config';
import { CircuitBreakerState } from '../providers/circuit-breaker';

describe('TtsProviderFactory', () => {
  let factory: TtsProviderFactory;

  beforeEach(async () => {
    const configService = new ConfigService({
      TTS_PROVIDER: 'edge-tts',
      TTS_PROVIDER_API_KEY: 'test-api-key',
      CIRCUIT_BREAKER_FAILURE_THRESHOLD: 3,
      CIRCUIT_BREAKER_TIMEOUT_MS: 30000,
      CIRCUIT_BREAKER_RECOVERY_TIMEOUT_MS: 60000,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TtsProviderFactory,
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    factory = module.get<TtsProviderFactory>(TtsProviderFactory);
  });

  it('should be defined', () => {
    expect(factory).toBeDefined();
  });

  describe('create', () => {
    it('should return a provider instance', () => {
      const provider = factory.create();
      expect(provider).toBeDefined();
      expect(typeof provider.synthesize).toBe('function');
      expect(typeof provider.checkAvailability).toBe('function');
    });

    it('should return cached provider on subsequent calls', () => {
      const provider1 = factory.create();
      const provider2 = factory.create();
      expect(provider1).toBe(provider2);
    });
  });

  describe('getProvidersStatus', () => {
    it('should return status for all providers', () => {
      const status = factory.getProvidersStatus();
      expect(status).toHaveLength(3);
      expect(status.map((s) => s.name)).toContain('edge-tts');
      expect(status.map((s) => s.name)).toContain('openai');
      expect(status.map((s) => s.name)).toContain('elevenlabs');
    });

    it('should return CLOSED state for all providers initially', () => {
      const status = factory.getProvidersStatus();
      status.forEach((s) => {
        expect(s.state).toBe(CircuitBreakerState.CLOSED);
        expect(s.failures).toBe(0);
      });
    });
  });

  describe('circuit breaker integration', () => {
    it('should allow resetting all circuit breakers', () => {
      factory.resetAllCircuitBreakers();
      const status = factory.getProvidersStatus();
      status.forEach((s) => {
        expect(s.state).toBe(CircuitBreakerState.CLOSED);
        expect(s.failures).toBe(0);
      });
    });
  });
});
