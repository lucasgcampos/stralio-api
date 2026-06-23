import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ITtsProvider } from './tts-provider.interface';
import { OpenAiProvider } from './openai.provider';
import { EdgeTtsProvider } from './edge-tts.provider';
import { ElevenLabsProvider } from './elevenlabs.provider';
import {
  CircuitBreaker,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
  CircuitBreakerState,
} from './circuit-breaker';
import { TtsException } from '../exceptions/tts.exception';

export interface ResilientTtsProvider {
  provider: ITtsProvider;
  circuitBreaker: CircuitBreaker;
  name: string;
}

@Injectable()
export class TtsProviderFactory {
  private readonly logger = new Logger(TtsProviderFactory.name);
  private readonly providers: ResilientTtsProvider[];
  private cachedProvider: ITtsProvider | null = null;

  constructor(private readonly configService: ConfigService) {
    this.providers = this.initializeProviders();
  }

  private getCircuitBreakerConfig() {
    return {
      failureThreshold:
        this.configService.get<number>('CIRCUIT_BREAKER_FAILURE_THRESHOLD') ??
        DEFAULT_CIRCUIT_BREAKER_CONFIG.failureThreshold,
      timeoutMs:
        this.configService.get<number>('CIRCUIT_BREAKER_TIMEOUT_MS') ??
        DEFAULT_CIRCUIT_BREAKER_CONFIG.timeoutMs,
      recoveryTimeoutMs:
        this.configService.get<number>('CIRCUIT_BREAKER_RECOVERY_TIMEOUT_MS') ??
        DEFAULT_CIRCUIT_BREAKER_CONFIG.recoveryTimeoutMs,
    };
  }

  private initializeProviders(): ResilientTtsProvider[] {
    const circuitConfig = this.getCircuitBreakerConfig();
    const result: ResilientTtsProvider[] = [];

    result.push({
      provider: new EdgeTtsProvider(this.configService),
      circuitBreaker: new CircuitBreaker(circuitConfig, 'edge-tts'),
      name: 'edge-tts',
    });

    result.push({
      provider: new OpenAiProvider(this.configService),
      circuitBreaker: new CircuitBreaker(circuitConfig, 'openai'),
      name: 'openai',
    });

    result.push({
      provider: new ElevenLabsProvider(this.configService),
      circuitBreaker: new CircuitBreaker(circuitConfig, 'elevenlabs'),
      name: 'elevenlabs',
    });

    return result;
  }

  create(): ITtsProvider {
    if (this.cachedProvider) {
      return this.cachedProvider;
    }

    this.cachedProvider = {
      synthesize: async (text: string, voiceId?: string): Promise<Buffer> => {
        const errors: Array<{ provider: string; error: string }> = [];

        for (const resilientProvider of this.providers) {
          const { provider, circuitBreaker, name } = resilientProvider;
          const state = circuitBreaker.getState();

          if (state === CircuitBreakerState.OPEN) {
            this.logger.debug(`Circuit breaker OPEN for ${name}, skipping`);
            errors.push({ provider: name, error: 'Circuit breaker OPEN' });
            continue;
          }

          try {
            const audioBuffer = await circuitBreaker.execute(() =>
              provider.synthesize(text, voiceId),
            );
            this.logger.log(`TTS synthesis successful using ${name}`);
            return audioBuffer;
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            this.logger.warn(`TTS provider ${name} failed: ${errorMessage}`);
            errors.push({ provider: name, error: errorMessage });
          }
        }

        const allErrors = errors
          .map((e) => `${e.provider}: ${e.error}`)
          .join('; ');

        this.logger.error(`All TTS providers failed. Errors: ${allErrors}`);

        throw new TtsException(
          'ALL_TTS_PROVIDERS_FAILED',
          `All TTS providers failed. Errors: ${allErrors}`,
        );
      },
      checkAvailability: async (): Promise<boolean> => {
        for (const { provider } of this.providers) {
          try {
            if (await provider.checkAvailability()) {
              return true;
            }
          } catch {
            continue;
          }
        }
        return false;
      },
    };

    return this.cachedProvider;
  }

  getProvidersStatus(): Array<{
    name: string;
    state: CircuitBreakerState;
    failures: number;
  }> {
    return this.providers.map(({ circuitBreaker, name }) => ({
      name,
      state: circuitBreaker.getState(),
      failures: circuitBreaker.getFailureCount(),
    }));
  }

  resetAllCircuitBreakers(): void {
    for (const { circuitBreaker } of this.providers) {
      circuitBreaker.reset();
    }
    this.logger.log('All circuit breakers have been reset');
  }
}
