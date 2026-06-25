import {
  CircuitBreaker,
  CircuitBreakerState,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
} from './circuit-breaker';

// Test callbacks intentionally don't use await since they return synchronously
/* eslint-disable @typescript-eslint/require-await */

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker(
      DEFAULT_CIRCUIT_BREAKER_CONFIG,
      'test-provider',
    );
  });

  describe('initial state', () => {
    it('should start in CLOSED state', () => {
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
    });

    it('should have zero failures initially', () => {
      expect(circuitBreaker.getFailureCount()).toBe(0);
    });
  });

  describe('successful execution', () => {
    it('should allow execution when in CLOSED state', async () => {
      const result = await circuitBreaker.execute(async () => 'success');
      expect(result).toBe('success');
    });

    it('should stay in CLOSED state after successful execution', async () => {
      await circuitBreaker.execute(async () => 'success');
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
    });
  });

  describe('failure handling', () => {
    it('should increment failure count on failure', async () => {
      await expect(
        circuitBreaker.execute(async () => {
          throw new Error('Provider failed');
        }),
      ).rejects.toThrow('Provider failed');

      expect(circuitBreaker.getFailureCount()).toBe(1);
    });

    it('should move to OPEN state after threshold failures', async () => {
      for (
        let i = 0;
        i < DEFAULT_CIRCUIT_BREAKER_CONFIG.failureThreshold;
        i++
      ) {
        await circuitBreaker
          .execute(async () => {
            throw new Error('Provider failed');
          })
          .catch(() => {});
      }

      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);
    });

    it('should throw when circuit is OPEN', async () => {
      for (
        let i = 0;
        i < DEFAULT_CIRCUIT_BREAKER_CONFIG.failureThreshold;
        i++
      ) {
        await circuitBreaker
          .execute(async () => {
            throw new Error('Provider failed');
          })
          .catch(() => {});
      }

      await expect(
        circuitBreaker.execute(async () => 'success'),
      ).rejects.toThrow('Circuit breaker is OPEN');
    });

    it('should allow execution when circuit is OPEN but recovery timeout passed', async () => {
      jest.useFakeTimers();

      for (
        let i = 0;
        i < DEFAULT_CIRCUIT_BREAKER_CONFIG.failureThreshold;
        i++
      ) {
        await circuitBreaker
          .execute(async () => {
            throw new Error('Provider failed');
          })
          .catch(() => {});
      }

      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);

      jest.advanceTimersByTime(
        DEFAULT_CIRCUIT_BREAKER_CONFIG.recoveryTimeoutMs + 1,
      );

      const result = await circuitBreaker.execute(async () => 'success');
      expect(result).toBe('success');

      jest.useRealTimers();
    });
  });

  describe('reset', () => {
    it('should reset to CLOSED state', async () => {
      await circuitBreaker
        .execute(async () => {
          throw new Error('Provider failed');
        })
        .catch(() => {});

      circuitBreaker.reset();

      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
      expect(circuitBreaker.getFailureCount()).toBe(0);
    });
  });

  describe('getProviderName', () => {
    it('should return the provider name', () => {
      expect(circuitBreaker.getProviderName()).toBe('test-provider');
    });
  });
});
