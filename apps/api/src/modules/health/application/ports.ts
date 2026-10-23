import type { HealthCheckResult } from '../domain/health-status.js';

export interface Clock {
  now(): Date;
}

/** One dependency to probe (database, queue...). Adapters live in infrastructure. */
export interface HealthIndicator {
  check(): Promise<HealthCheckResult>;
}

export const CLOCK = Symbol('Clock');
export const HEALTH_INDICATORS = Symbol('HealthIndicators');
