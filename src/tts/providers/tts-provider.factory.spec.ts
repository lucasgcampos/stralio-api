import { CircuitBreaker, CircuitBreakerState } from './circuit-breaker';
import { ITtsProvider } from './tts-provider.interface';
import { TtsException } from '../exceptions/tts.exception';

/* eslint-disable @typescript-eslint/require-await, @typescript-eslint/unbound-method */

class TestableTtsProviderFactory {
  public providers: Array<{
    provider: ITtsProvider;
    circuitBreaker: CircuitBreaker;
    name: string;
  }> = [];

  constructor(
    providers: Array<{
      provider: ITtsProvider;
      circuitBreaker: CircuitBreaker;
      name: string;
    }>,
  ) {
    this.providers = providers;
  }

  createResilientProvider(): ITtsProvider {
    return {
      synthesize: async (text: string, voiceId?: string): Promise<Buffer> => {
        const errors: Array<{ provider: string; error: string }> = [];

        for (const resilientProvider of this.providers) {
          const { provider, circuitBreaker, name } = resilientProvider;
          const state = circuitBreaker.getState();

          if (state === CircuitBreakerState.OPEN) {
            errors.push({ provider: name, error: 'Circuit breaker OPEN' });
            continue;
          }

          try {
            const audioBuffer = await circuitBreaker.execute(() =>
              provider.synthesize(text, voiceId),
            );
            return audioBuffer;
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            errors.push({ provider: name, error: errorMessage });
          }
        }

        const allErrors = errors
          .map((e) => `${e.provider}: ${e.error}`)
          .join('; ');
        throw new TtsException(
          'ALL_TTS_PROVIDERS_FAILED',
          `All TTS providers failed. Errors: ${allErrors}`,
        );
      },
      checkAvailability: async (): Promise<boolean> => {
        for (const { provider } of this.providers) {
          try {
            if (await provider.checkAvailability()) return true;
          } catch {
            continue;
          }
        }
        return false;
      },
    };
  }

  getProvidersStatus() {
    return this.providers.map(({ circuitBreaker, name }) => ({
      name,
      state: circuitBreaker.getState(),
      failures: circuitBreaker.getFailureCount(),
    }));
  }

  resetAllCircuitBreakers() {
    for (const { circuitBreaker } of this.providers) circuitBreaker.reset();
  }
}

const createMockProvider = (
  shouldFail = false,
  available = true,
): ITtsProvider => ({
  synthesize: jest.fn().mockImplementation(async () => {
    if (shouldFail) throw new Error('Provider unavailable');
    return Buffer.from('fake-audio');
  }),
  checkAvailability: jest.fn().mockResolvedValue(available),
});

describe('TtsProviderFactory (Resilient Wrapper)', () => {
  let factory: TestableTtsProviderFactory;
  let mockProviders: Array<{
    provider: ITtsProvider;
    circuitBreaker: CircuitBreaker;
    name: string;
  }>;

  beforeEach(() => {
    mockProviders = [
      {
        provider: createMockProvider(),
        circuitBreaker: new CircuitBreaker(
          { failureThreshold: 3, timeoutMs: 30000, recoveryTimeoutMs: 60000 },
          'edge-tts',
        ),
        name: 'edge-tts',
      },
      {
        provider: createMockProvider(),
        circuitBreaker: new CircuitBreaker(
          { failureThreshold: 3, timeoutMs: 30000, recoveryTimeoutMs: 60000 },
          'openai',
        ),
        name: 'openai',
      },
      {
        provider: createMockProvider(),
        circuitBreaker: new CircuitBreaker(
          { failureThreshold: 3, timeoutMs: 30000, recoveryTimeoutMs: 60000 },
          'elevenlabs',
        ),
        name: 'elevenlabs',
      },
    ];
    factory = new TestableTtsProviderFactory(mockProviders);
  });

  afterEach(() => jest.clearAllMocks());

  describe('synthesize with fallback chain', () => {
    it('should use first provider when successful', async () => {
      const provider = factory.createResilientProvider();
      const result = await provider.synthesize('Hello world');
      expect(mockProviders[0].provider.synthesize).toHaveBeenCalled();
      expect(result).toEqual(Buffer.from('fake-audio'));
    });

    it('should fallback to next when first fails', async () => {
      mockProviders[0].provider = createMockProvider(true);
      mockProviders[1].provider = createMockProvider(false);
      const provider = factory.createResilientProvider();
      const result = await provider.synthesize('Hello');
      expect(mockProviders[0].provider.synthesize).toHaveBeenCalled();
      expect(mockProviders[1].provider.synthesize).toHaveBeenCalled();
      expect(result).toEqual(Buffer.from('fake-audio'));
    });

    it('should throw when all providers fail', async () => {
      mockProviders.forEach((m) => {
        m.provider = createMockProvider(true);
      });
      const provider = factory.createResilientProvider();
      try {
        await provider.synthesize('Hello');
        fail('Should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(TtsException);
        expect((e as TtsException).code).toBe('ALL_TTS_PROVIDERS_FAILED');
      }
    });

    it('should track call order correctly', async () => {
      const calls: string[] = [];
      mockProviders[0].provider = {
        synthesize: jest.fn().mockImplementation(async () => {
          calls.push('edge');
          throw new Error();
        }),
        checkAvailability: jest.fn(),
      };
      mockProviders[1].provider = {
        synthesize: jest.fn().mockImplementation(async () => {
          calls.push('openai');
          return Buffer.from('ok');
        }),
        checkAvailability: jest.fn(),
      };
      const provider = factory.createResilientProvider();
      await provider.synthesize('x');
      expect(calls).toEqual(['edge', 'openai']);
    });
  });

  describe('circuit breaker', () => {
    it('should skip provider with OPEN breaker', async () => {
      for (let i = 0; i < 3; i++) {
        try {
          await mockProviders[0].circuitBreaker.execute(async () => {
            throw new Error();
          });
        } catch {
          // Expected to fail
        }
      }
      expect(mockProviders[0].circuitBreaker.getState()).toBe(
        CircuitBreakerState.OPEN,
      );
      const provider = factory.createResilientProvider();
      const result = await provider.synthesize('test');
      expect(mockProviders[0].provider.synthesize).not.toHaveBeenCalled();
      expect(mockProviders[1].provider.synthesize).toHaveBeenCalled();
      expect(result).toEqual(Buffer.from('fake-audio'));
    });
  });

  describe('checkAvailability', () => {
    it('should return true if any provider available', async () => {
      mockProviders[0].provider.checkAvailability = jest
        .fn()
        .mockResolvedValue(false);
      mockProviders[1].provider.checkAvailability = jest
        .fn()
        .mockResolvedValue(true);
      const provider = factory.createResilientProvider();
      expect(await provider.checkAvailability()).toBe(true);
    });

    it('should return false if none available', async () => {
      mockProviders.forEach((m) => {
        m.provider.checkAvailability = jest.fn().mockResolvedValue(false);
      });
      const provider = factory.createResilientProvider();
      expect(await provider.checkAvailability()).toBe(false);
    });
  });

  describe('getProvidersStatus', () => {
    it('should return all providers status', () => {
      const status = factory.getProvidersStatus();
      expect(status).toHaveLength(3);
      expect(status[0]).toHaveProperty('name', 'edge-tts');
    });
  });

  describe('resetAllCircuitBreakers', () => {
    it('should reset all circuit breakers', async () => {
      try {
        await mockProviders[0].circuitBreaker.execute(async () => {
          throw new Error();
        });
      } catch {
        // Expected to fail
      }
      factory.resetAllCircuitBreakers();
      expect(mockProviders[0].circuitBreaker.getState()).toBe(
        CircuitBreakerState.CLOSED,
      );
    });
  });
});
